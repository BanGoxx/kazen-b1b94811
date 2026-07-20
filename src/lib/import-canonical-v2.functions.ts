// KAZEN — Import Canonicalization V2 — server-function boundary (Phase G).
//
// This is the ONLY surface `/import` may call for V2. Every function:
//   * runs behind `requireSupabaseAuth`;
//   * derives `userId` from the validated bearer token (NEVER from the client);
//   * checks the feature flag + allowlist server-side via the .server module;
//   * imports `.server.ts` orchestrator lazily inside the handler body, so
//     `supabaseAdmin` never leaks into the client bundle;
//   * returns structured, safe DTOs (no claim_token, no error_message internals,
//     no secrets).
//
// V1/V2 SELECTION: `isCanonicalImportV2Enabled` is the ONLY authority. The
// client MUST NOT decide V1 vs V2 via query param, localStorage, cookie or
// hidden UI toggle.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Input validators (strip client-supplied metadata) ----------

interface CanonV2CreateInput {
  provider: "anilist";
  items: Array<{ provider_ref: string; user_action?: Record<string, unknown> }>;
  meta?: Record<string, unknown>;
}

function validateCreateInput(raw: unknown): CanonV2CreateInput {
  if (!raw || typeof raw !== "object") throw new Error("invalid_canonical_payload");
  const d = raw as Record<string, unknown>;
  if (d.provider !== "anilist") throw new Error("invalid_canonical_payload: unsupported provider");
  if (!Array.isArray(d.items) || d.items.length === 0) {
    throw new Error("invalid_canonical_payload: items empty");
  }
  if (d.items.length > 5000) throw new Error("invalid_canonical_payload: items too many");
  const items = d.items.map((r) => {
    if (!r || typeof r !== "object") throw new Error("invalid_canonical_payload: item shape");
    const row = r as Record<string, unknown>;
    const providerRef = String(row.provider_ref ?? "").trim();
    if (!providerRef || providerRef.length > 512) {
      throw new Error("invalid_canonical_payload: bad provider_ref");
    }
    // Whitelist: only user_action; strip title/poster/genres/score/... coming
    // from the browser — the DB `build_canonical` is the sole authority.
    const out: { provider_ref: string; user_action?: Record<string, unknown> } = {
      provider_ref: providerRef,
    };
    if (row.user_action && typeof row.user_action === "object" && !Array.isArray(row.user_action)) {
      out.user_action = row.user_action as Record<string, unknown>;
    }
    return out;
  });
  // meta is opaque tracking metadata (fileName, provider tag) — NEVER canonical.
  const meta =
    d.meta && typeof d.meta === "object" && !Array.isArray(d.meta)
      ? (d.meta as Record<string, unknown>)
      : undefined;
  return { provider: "anilist", items, ...(meta ? { meta } : {}) };
}

function validateBatchId(raw: unknown): string {
  if (typeof raw !== "string" || !raw) throw new Error("invalid_batch_id");
  if (raw.length > 64) throw new Error("invalid_batch_id");
  // uuid-ish (server RPC will reject anything malformed anyway).
  if (!/^[0-9a-fA-F-]{8,64}$/.test(raw)) throw new Error("invalid_batch_id");
  return raw;
}

function validateItemIds(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("invalid_item_ids");
  if (raw.length > 5000) throw new Error("invalid_item_ids");
  return raw.map((v) => {
    if (typeof v !== "string" || !v || v.length > 64 || !/^[0-9a-fA-F-]{8,64}$/.test(v)) {
      throw new Error("invalid_item_ids");
    }
    return v;
  });
}

// JSON-safe boundary types (`Record<string, unknown>` fails TanStack's
// strict serializer). We stringify+parse to force JSON primitives across
// the RPC boundary — Date/class instances/functions cannot leak through.
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };
function jsonSafe(v: unknown): { [k: string]: JsonValue } {
  return JSON.parse(JSON.stringify(v ?? {})) as { [k: string]: JsonValue };
}

// ---------- Server functions exposed to /import ----------

/**
 * Gate evaluation helper — extracted so unit tests can prove:
 *   1. we call the `authenticated`-granted `import_canonical_v2_is_enabled()`
 *      no-arg RPC, NEVER the service_role-only
 *      `import_canonical_v2__is_enabled_for_user(uuid)` internal helper;
 *   2. we never accept a client-supplied `user_id`;
 *   3. we fail closed on RPC error (enabled=false).
 */
export const CANONICAL_V2_GATE_RPC = "import_canonical_v2_is_enabled" as const;

export interface CanonicalV2GateSupabase {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

export async function evaluateCanonicalV2Gate(
  supabase: CanonicalV2GateSupabase,
): Promise<{ enabled: boolean }> {
  const { data, error } = await supabase.rpc(CANONICAL_V2_GATE_RPC);
  if (error) return { enabled: false };
  return { enabled: Boolean(data) };
}

/**
 * Server-side V1/V2 gate. The ONLY authoritative signal. `/import` must call
 * this and never look at query strings/localStorage/cookies to pick a path.
 * The no-arg RPC reads auth.uid() server-side and is granted to
 * `authenticated`; the `__is_enabled_for_user(uuid)` helper is service_role
 * only and MUST NOT be called from here.
 */
export const isCanonicalImportV2Enabled = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return evaluateCanonicalV2Gate(context.supabase as unknown as CanonicalV2GateSupabase);
  });




export const createCanonicalBatchV2Fn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateCreateInput)
  .handler(async ({ data, context }) => {
    const { buildAuthContext, createCanonicalBatchV2 } = await import(
      "./import-canonical-v2.server"
    );
    const ctx = buildAuthContext(context.supabase, context.userId);
    const { batchId } = await createCanonicalBatchV2(ctx, data);
    return { batchId };
  });

export const processCanonicalBatchV2Fn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { batchId: string; maxChunks?: number }) => ({
    batchId: validateBatchId(raw?.batchId),
    maxChunks:
      typeof raw?.maxChunks === "number" && raw.maxChunks > 0
        ? Math.min(Math.floor(raw.maxChunks), 4)
        : 2,
  }))
  .handler(async ({ data, context }) => {
    const { buildAuthContext, processCanonicalBatchV2 } = await import(
      "./import-canonical-v2.server"
    );
    const ctx = buildAuthContext(context.supabase, context.userId);
    const res = await processCanonicalBatchV2(ctx, data.batchId, { maxChunks: data.maxChunks });
    // Safe DTO — do NOT return claim tokens or admin metadata.
    return {
      chunksProcessed: res.chunksProcessed,
      storedCanonical: res.storedCanonical,
      storedFailed: res.storedFailed,
      releasedRetryable: res.releasedRetryable,
      batchStatus: res.batchStatus ?? null,
      done: res.done,
    };
  });

export const getCanonicalProgressV2Fn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { batchId: string }) => ({ batchId: validateBatchId(raw?.batchId) }))
  .handler(async ({ data, context }) => {
    const { buildAuthContext, getCanonicalProgressV2 } = await import(
      "./import-canonical-v2.server"
    );
    const ctx = buildAuthContext(context.supabase, context.userId);
    return jsonSafe(await getCanonicalProgressV2(ctx, data.batchId));
  });

export const getCanonicalPreviewV2Fn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { batchId: string }) => ({ batchId: validateBatchId(raw?.batchId) }))
  .handler(async ({ data, context }) => {
    const { buildAuthContext, getCanonicalPreviewV2 } = await import(
      "./import-canonical-v2.server"
    );
    const ctx = buildAuthContext(context.supabase, context.userId);
    const preview = await getCanonicalPreviewV2(ctx, data.batchId);
    // Owner-only items already filtered by RLS SELECT in .server.ts.
    // Sanitize once more here as defence in depth (drop unknown fields).
    return {
      counters: jsonSafe(preview.counters),
      items: preview.items.map((i) => ({
        id: i.id,
        ordinal: i.ordinal,
        provider_ref: i.provider_ref,
        status: i.status,
        canonical_snapshot: jsonSafe(i.canonical_snapshot as object | null),
        error_code: i.error_code,
      })),
    };
  });

export const confirmCanonicalImportV2Fn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { batchId: string }) => ({ batchId: validateBatchId(raw?.batchId) }))
  .handler(async ({ data, context }) => {
    const { buildAuthContext, confirmCanonicalImportV2 } = await import(
      "./import-canonical-v2.server"
    );
    const ctx = buildAuthContext(context.supabase, context.userId);
    return jsonSafe(await confirmCanonicalImportV2(ctx, data.batchId));
  });

export const skipFailedCanonicalItemsV2Fn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { batchId: string; itemIds: string[] }) => ({
    batchId: validateBatchId(raw?.batchId),
    itemIds: validateItemIds(raw?.itemIds),
  }))
  .handler(async ({ data, context }) => {
    const { buildAuthContext, skipFailedCanonicalItemsV2 } = await import(
      "./import-canonical-v2.server"
    );
    const ctx = buildAuthContext(context.supabase, context.userId);
    return jsonSafe(await skipFailedCanonicalItemsV2(ctx, data.batchId, data.itemIds));
  });

export const rollbackCanonicalImportV2Fn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { batchId: string }) => ({ batchId: validateBatchId(raw?.batchId) }))
  .handler(async ({ data, context }) => {
    const { buildAuthContext, rollbackCanonicalImportV2 } = await import(
      "./import-canonical-v2.server"
    );
    const ctx = buildAuthContext(context.supabase, context.userId);
    return jsonSafe(await rollbackCanonicalImportV2(ctx, data.batchId));
  });
