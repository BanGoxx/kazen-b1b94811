// KAZEN — Import Canonicalization V2 — server-only orchestrator (Phase F+1).
//
// SECURITY MODEL
// ==============
//   * `.server.ts` extension → filename-blocked from client bundles. Only
//     imported from inside a server-fn `.handler()` body via `await import`.
//   * Public API takes an opaque `AuthContext` (branded object) built ONLY
//     by `buildAuthContext(supabaseUser, userId)` inside a serverFn that
//     used `requireSupabaseAuth`. `userId` is never a stand-alone parameter.
//   * Worker helpers call `import_canonical_v2__is_enabled_for_user(user_id)`
//     BEFORE any admin RPC. Ownership is asserted through the member client
//     (`assertOwnership`) before any service_role RPC.
//
// TRUST BOUNDARY
// ==============
//   * The only canonical source is AniList's HTTPS GraphQL API. Client
//     payloads are stripped to `{provider, provider_ref, user_action}`; DB
//     `build_canonical` re-validates the final snapshot.
//
// RATE LIMITING
// =============
//   * Outbound traffic goes through the SHARED AniList queue
//     (`withAniListSlot`) — the same 450 ms FIFO used by fiches/list rails.
//     No parallel budget. On top, V2 also enforces a per-window token
//     bucket (default 30 req/min) as an additional ceiling.
//   * Retryable errors release the DB claim IMMEDIATELY — never held across
//     a wait. Backoff is bounded by `MAX_ATTEMPTS`.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { withAniListSlot } from "./anilist-shared-queue.server";

type UserClient = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Auth context — opaque brand. `buildAuthContext` is the only constructor;
// the shape is not exported so no client-reachable code can synthesise one.
// ---------------------------------------------------------------------------

const AUTH_BRAND = Symbol("kazen.v2.auth");

export interface AuthContext {
  readonly [AUTH_BRAND]: true;
  readonly supabase: UserClient;
  readonly userId: string;
}

export function buildAuthContext(supabase: UserClient, userId: string): AuthContext {
  if (!userId || typeof userId !== "string") throw new Error("invalid_auth_context");
  return { [AUTH_BRAND]: true, supabase, userId } as AuthContext;
}

function requireAuth(ctx: AuthContext): void {
  if (!ctx || ctx[AUTH_BRAND] !== true) throw new Error("invalid_auth_context");
}

// ---------------------------------------------------------------------------
// AniList transport
// ---------------------------------------------------------------------------

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const DEFAULT_REQUEST_TIMEOUT_MS = 8000;
const CANON_TOKEN_BUCKET_LIMIT = 30;
const CANON_TOKEN_BUCKET_WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const MAX_CHUNK_SIZE = 50;
const PROVIDER_CACHE_TTL_MS = 5 * 60_000;

interface AniListMedia {
  id: number;
  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  } | null;
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
    medium?: string | null;
  } | null;
  bannerImage?: string | null;
  genres?: string[] | null;
  averageScore?: number | null;
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
}

interface AniListPageResponse {
  data?: { Page?: { media?: AniListMedia[] } };
  errors?: { message?: string }[];
}

export type RetryableProviderError =
  | "provider_rate_limited"
  | "provider_timeout"
  | "provider_unavailable";
export type TerminalProviderError =
  | "provider_not_found"
  | "provider_id_mismatch"
  | "invalid_canonical_payload";

export class ProviderError extends Error {
  code: RetryableProviderError | TerminalProviderError;
  retryAfterMs?: number;
  constructor(
    code: RetryableProviderError | TerminalProviderError,
    message?: string,
    retryAfterMs?: number,
  ) {
    super(message ?? code);
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

export function isRetryable(code: string): code is RetryableProviderError {
  return (
    code === "provider_rate_limited" ||
    code === "provider_timeout" ||
    code === "provider_unavailable"
  );
}

// ---------------------------------------------------------------------------
// Dependency injection seams. Never wired from client input.
// ---------------------------------------------------------------------------

export interface CanonDeps {
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  admin: () => Promise<UserClient>;
  tokenBucketLimit: number;
  tokenBucketWindowMs: number;
  requestTimeoutMs: number;
  cache: Map<number, { at: number; media: AniListMedia }>;
  recentIssuedAt: number[];
}

async function defaultAdmin(): Promise<UserClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as UserClient;
}

function makeDefaultDeps(): CanonDeps {
  return {
    fetch: (input, init) => fetch(input as Parameters<typeof fetch>[0], init),
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    admin: defaultAdmin,
    tokenBucketLimit: CANON_TOKEN_BUCKET_LIMIT,
    tokenBucketWindowMs: CANON_TOKEN_BUCKET_WINDOW_MS,
    requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    cache: new Map(),
    recentIssuedAt: [],
  };
}

const defaultDeps: CanonDeps = makeDefaultDeps();

async function waitForToken(deps: CanonDeps): Promise<void> {
  // Sliding-window rate limiter — additive on top of the shared AniList
  // queue. Guarantees no more than `limit` V2 requests per window.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const now = deps.now();
    while (
      deps.recentIssuedAt.length > 0 &&
      now - deps.recentIssuedAt[0]! > deps.tokenBucketWindowMs
    ) {
      deps.recentIssuedAt.shift();
    }
    if (deps.recentIssuedAt.length < deps.tokenBucketLimit) {
      deps.recentIssuedAt.push(now);
      return;
    }
    const oldest = deps.recentIssuedAt[0] ?? now;
    const wait = Math.max(50, deps.tokenBucketWindowMs - (now - oldest));
    await deps.sleep(wait);
  }
}

function jitter(base: number): number {
  return Math.floor(base * (0.5 + Math.random()));
}

/**
 * Batched AniList fetch — up to 50 numeric ids per request. Always routes
 * through the shared 450 ms serial queue AND the V2 token bucket.
 */
export async function fetchAniListBatch(
  ids: number[],
  opts?: { signal?: AbortSignal; deps?: CanonDeps },
): Promise<Map<number, AniListMedia>> {
  const deps = opts?.deps ?? defaultDeps;
  const clean = Array.from(new Set(ids.filter((n) => Number.isInteger(n) && n > 0)));
  if (clean.length === 0) return new Map();
  if (clean.length > MAX_CHUNK_SIZE) {
    throw new ProviderError(
      "invalid_canonical_payload",
      `AniList batch max is ${MAX_CHUNK_SIZE} ids`,
    );
  }

  const now = deps.now();
  const out = new Map<number, AniListMedia>();
  const missing: number[] = [];
  for (const id of clean) {
    const hit = deps.cache.get(id);
    if (hit && now - hit.at < PROVIDER_CACHE_TTL_MS) out.set(id, hit.media);
    else missing.push(id);
  }
  if (missing.length === 0) return out;

  await waitForToken(deps);

  const gql = `query ($ids: [Int]) {
    Page(page: 1, perPage: ${MAX_CHUNK_SIZE}) {
      media(id_in: $ids, type: ANIME) {
        id
        title { romaji english native }
        coverImage { extraLarge large medium }
        bannerImage
        genres
        averageScore
        startDate { year month day }
      }
    }
  }`;

  const doFetch = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), deps.requestTimeoutMs);
    const external = opts?.signal;
    const onAbort = () => controller.abort();
    if (external) external.addEventListener("abort", onAbort, { once: true });
    try {
      return await deps.fetch(ANILIST_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Origin: "https://anilist.co",
          Referer: "https://anilist.co/",
        },
        body: JSON.stringify({ query: gql, variables: { ids: missing } }),
      });
    } finally {
      clearTimeout(timeout);
      if (external) external.removeEventListener("abort", onAbort);
    }
  };

  let res: Response;
  try {
    // Shared 450 ms queue — same one that gates fiche/list traffic. Only used
    // for the real default `fetch`; injected fetchers (tests, harness) don't
    // need serialisation.
    if (deps.fetch === defaultDeps.fetch) {
      res = await withAniListSlot(doFetch);
    } else {
      res = await doFetch();
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new ProviderError("provider_timeout", "AniList request timed out");
    }
    throw new ProviderError("provider_unavailable", (err as Error)?.message);
  }

  if (res.status === 429) {
    const h = res.headers.get("retry-after");
    const retryAfterMs = h ? Math.min(60_000, Number(h) * 1000) : 5_000;
    throw new ProviderError("provider_rate_limited", "AniList 429", retryAfterMs);
  }
  if (res.status >= 500) throw new ProviderError("provider_unavailable", `AniList HTTP ${res.status}`);
  if (!res.ok) throw new ProviderError("provider_unavailable", `AniList HTTP ${res.status}`);

  let json: AniListPageResponse;
  try {
    json = (await res.json()) as AniListPageResponse;
  } catch {
    throw new ProviderError("provider_unavailable", "AniList: non-JSON response");
  }
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e?.message ?? "").filter(Boolean).join("; ");
    throw new ProviderError("provider_unavailable", `AniList errors: ${msg}`);
  }
  const media = json.data?.Page?.media ?? [];
  const stamp = deps.now();
  for (const m of media) {
    if (!m || typeof m.id !== "number") continue;
    out.set(m.id, m);
    deps.cache.set(m.id, { at: stamp, media: m });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Normalisation — server-side only. Preserves AniList 0..100 score (DB
// contract). Only emits full YYYY-MM-DD; anything less is null (no
// invention of 01-01 for partial dates).
// ---------------------------------------------------------------------------

const ANILIST_CDN_HOST = "s4.anilist.co";

export function safeHttps(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    if (url.protocol !== "https:") return null;
    if (url.host !== ANILIST_CDN_HOST) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function pickTitle(
  m: AniListMedia,
): { title: string; original: string | null } | null {
  const t = m.title ?? {};
  const primary = t.english?.trim() || t.romaji?.trim() || t.native?.trim() || null;
  if (!primary) return null;
  const original = t.native?.trim() || t.romaji?.trim() || null;
  return {
    title: primary.slice(0, 300),
    original: original && original !== primary ? original.slice(0, 300) : null,
  };
}

/**
 * V2 release_date policy:
 *   - year+month+day present AND a real calendar date → "YYYY-MM-DD"
 *   - otherwise (partial, impossible, missing) → null
 *
 * NEVER invents "-01-01" for a year-only date. The DB layer would accept
 * partial "YYYY" or "YYYY-MM" (see regex in build_canonical), but a partial
 * date leads to misleading fiches; V2 elevates the bar and stores only
 * fully-verified dates.
 */
export function pickReleaseDate(m: AniListMedia): string | null {
  const y = m.startDate?.year;
  const mo = m.startDate?.month;
  const d = m.startDate?.day;
  if (
    typeof y !== "number" ||
    typeof mo !== "number" ||
    typeof d !== "number" ||
    !Number.isInteger(y) ||
    !Number.isInteger(mo) ||
    !Number.isInteger(d)
  ) {
    return null;
  }
  if (y < 1900 || y > 2100) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  // Real calendar validation — rejects 2001-02-29 etc.
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * V2 score policy: preserve AniList's 0..100 scale exactly (DB contract in
 * `import_canonical_v2_build_canonical` accepts numeric in [0, 100]). UI
 * conversion to /10 is a presentation-layer concern and MUST NOT mutate the
 * canonical value.
 */
export function pickScore(m: AniListMedia): number | null {
  const s = m.averageScore;
  if (typeof s !== "number") return null;
  if (!Number.isFinite(s)) return null;
  const rounded = Math.round(s);
  if (rounded < 0 || rounded > 100) return null;
  return rounded;
}

export interface CanonicalSnapshot {
  source: "anilist";
  external_id: string;
  media_key: string;
  media_type: "anime";
  title: string;
  title_original: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  release_date: string | null;
  genres: string[];
  score: number | null;
}

export function buildCanonicalSnapshot(m: AniListMedia): CanonicalSnapshot | null {
  if (!m || typeof m.id !== "number" || m.id <= 0) return null;
  const t = pickTitle(m);
  if (!t) return null;
  const externalId = String(m.id);
  const genres = Array.isArray(m.genres)
    ? m.genres
        .filter((g): g is string => typeof g === "string" && g.length > 0 && g.length <= 60)
        .slice(0, 24)
    : [];
  return {
    source: "anilist",
    external_id: externalId,
    media_key: `anilist:${externalId}`,
    media_type: "anime",
    title: t.title,
    title_original: t.original,
    poster_url: safeHttps(m.coverImage?.extraLarge ?? m.coverImage?.large ?? m.coverImage?.medium),
    backdrop_url: safeHttps(m.bannerImage),
    release_date: pickReleaseDate(m),
    genres,
    score: pickScore(m),
  };
}

// ---------------------------------------------------------------------------
// Admin/enablement helpers
// ---------------------------------------------------------------------------

async function isEnabledForUser(userId: string, deps: CanonDeps): Promise<boolean> {
  const a = await deps.admin();
  const { data, error } = await a.rpc("import_canonical_v2__is_enabled_for_user", {
    _user_id: userId,
  });
  if (error) return false;
  return Boolean(data);
}

async function assertOwnership(ctx: AuthContext): Promise<void> {
  requireAuth(ctx);
}

async function assertBatchOwnership(ctx: AuthContext, batchId: string): Promise<void> {
  const { data, error } = await ctx.supabase
    .from("import_canonical_v2_batches")
    .select("id,user_id,status")
    .eq("id", batchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("batch_not_found");
  if (data.user_id !== ctx.userId) throw new Error("forbidden");
}

// ---------------------------------------------------------------------------
// Member-facing orchestrator API — all take an AuthContext (opaque brand).
// ---------------------------------------------------------------------------

export interface CreateBatchInput {
  provider: "anilist";
  items: Array<{
    provider_ref: string;
    user_action?: Record<string, unknown>;
  }>;
  meta?: Record<string, unknown>;
}

export async function createCanonicalBatchV2(
  ctx: AuthContext,
  input: CreateBatchInput,
  deps: CanonDeps = defaultDeps,
): Promise<{ batchId: string }> {
  requireAuth(ctx);
  if (!(await isEnabledForUser(ctx.userId, deps))) throw new Error("feature_disabled");
  if (!input || input.provider !== "anilist") {
    throw new Error("invalid_canonical_payload: unsupported provider");
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("invalid_canonical_payload: items empty");
  }
  const cleanItems = input.items.map((raw) => {
    const providerRef = String(raw?.provider_ref ?? "").trim();
    if (!providerRef) throw new Error("invalid_canonical_payload: missing provider_ref");
    if (providerRef.length > 512) throw new Error("invalid_canonical_payload: provider_ref too long");
    return raw?.user_action
      ? { provider_ref: providerRef, user_action: raw.user_action }
      : { provider_ref: providerRef };
  });
  const payload = {
    provider: "anilist",
    items: cleanItems,
    ...(input.meta ? { meta: input.meta } : {}),
  };
  const { data, error } = await ctx.supabase.rpc("import_canonical_v2_create_batch", {
    _payload: payload as unknown as never,
  });
  if (error) throw new Error(error.message);
  return { batchId: data as unknown as string };
}

export async function getCanonicalProgressV2(
  ctx: AuthContext,
  batchId: string,
  deps: CanonDeps = defaultDeps,
): Promise<Record<string, unknown>> {
  requireAuth(ctx);
  if (!(await isEnabledForUser(ctx.userId, deps))) throw new Error("feature_disabled");
  const { data, error } = await ctx.supabase.rpc("import_canonical_v2_progress", {
    _batch_id: batchId,
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, unknown>;
}

export interface CanonicalPreviewItemV2 {
  id: string;
  ordinal: number;
  provider_ref: string;
  status: string;
  canonical_snapshot: unknown;
  error_code: string | null;
}

export interface CanonicalPreviewV2 {
  counters: Record<string, unknown>;
  items: CanonicalPreviewItemV2[];
}

export async function getCanonicalPreviewV2(
  ctx: AuthContext,
  batchId: string,
  deps: CanonDeps = defaultDeps,
): Promise<CanonicalPreviewV2> {
  requireAuth(ctx);
  if (!(await isEnabledForUser(ctx.userId, deps))) throw new Error("feature_disabled");
  const { data: counters, error: rpcErr } = await ctx.supabase.rpc(
    "import_canonical_v2_preview",
    { _batch_id: batchId },
  );
  if (rpcErr) throw new Error(rpcErr.message);
  // Owner-only items via RLS SELECT (auth.uid() = user_id).
  // Safe columns only — never claim_token, error_message, admin/private fields.
  const { data: rawItems, error: selErr } = await ctx.supabase
    .from("import_canonical_v2_items")
    .select("id,ordinal,provider_ref,status,canonical_snapshot,error_code")
    .eq("batch_id", batchId)
    .order("ordinal", { ascending: true });
  if (selErr) throw new Error(selErr.message);
  return {
    counters: (counters ?? {}) as Record<string, unknown>,
    items: (rawItems ?? []) as CanonicalPreviewItemV2[],
  };
}

export async function confirmCanonicalImportV2(
  ctx: AuthContext,
  batchId: string,
  deps: CanonDeps = defaultDeps,
): Promise<Record<string, unknown>> {
  requireAuth(ctx);
  if (!(await isEnabledForUser(ctx.userId, deps))) throw new Error("feature_disabled");
  const { data, error } = await ctx.supabase.rpc("import_canonical_v2_confirm", {
    _batch_id: batchId,
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, unknown>;
}

export async function rollbackCanonicalImportV2(
  ctx: AuthContext,
  batchId: string,
  deps: CanonDeps = defaultDeps,
): Promise<Record<string, unknown>> {
  requireAuth(ctx);
  if (!(await isEnabledForUser(ctx.userId, deps))) throw new Error("feature_disabled");
  const { data, error } = await ctx.supabase.rpc("import_canonical_v2_rollback", {
    _batch_id: batchId,
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, unknown>;
}

export async function skipFailedCanonicalItemsV2(
  ctx: AuthContext,
  batchId: string,
  itemIds: string[],
  deps: CanonDeps = defaultDeps,
): Promise<Record<string, unknown>> {
  requireAuth(ctx);
  if (!(await isEnabledForUser(ctx.userId, deps))) throw new Error("feature_disabled");
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw new Error("invalid_canonical_payload: item_ids empty");
  }
  const { data, error } = await ctx.supabase.rpc("import_canonical_v2_skip_failed", {
    _batch_id: batchId,
    _item_ids: itemIds,
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Worker (admin-backed). Ownership asserted via the MEMBER client first.
// ---------------------------------------------------------------------------

export interface ProcessorOptions {
  maxChunks?: number;
  chunkSize?: number;
  fetcher?: (ids: number[], signal?: AbortSignal) => Promise<Map<number, AniListMedia>>;
  signal?: AbortSignal;
  deps?: CanonDeps;
}

export interface ProcessorResult {
  chunksProcessed: number;
  storedCanonical: number;
  storedFailed: number;
  releasedRetryable: number;
  batchStatus?: string;
  done: boolean;
}

export async function processCanonicalBatchV2(
  ctx: AuthContext,
  batchId: string,
  opts?: ProcessorOptions,
): Promise<ProcessorResult> {
  requireAuth(ctx);
  const deps = opts?.deps ?? defaultDeps;
  if (!(await isEnabledForUser(ctx.userId, deps))) throw new Error("feature_disabled");
  await assertOwnership(ctx);
  await assertBatchOwnership(ctx, batchId);

  const chunkSize = Math.min(Math.max(1, Math.floor(opts?.chunkSize ?? 25)), MAX_CHUNK_SIZE);
  const maxChunks = Math.min(Math.max(1, Math.floor(opts?.maxChunks ?? 4)), 20);
  const fetcher =
    opts?.fetcher ??
    ((ids, signal) => fetchAniListBatch(ids, { signal, deps }));

  const a = await deps.admin();
  const result: ProcessorResult = {
    chunksProcessed: 0,
    storedCanonical: 0,
    storedFailed: 0,
    releasedRetryable: 0,
    done: false,
  };

  for (let round = 0; round < maxChunks; round += 1) {
    const claim = await a.rpc("import_canonical_v2_claim_chunk", {
      _batch_id: batchId,
      _chunk_size: chunkSize,
    });
    if (claim.error) throw new Error(claim.error.message);
    const claimed = (claim.data ?? []) as Array<{
      item_id: string;
      provider_ref: string;
      claim_token: string;
      attempts: number;
    }>;
    if (claimed.length === 0) {
      result.done = true;
      break;
    }
    const claimToken = claimed[0]!.claim_token;
    const ids = claimed
      .map((c) => Number(c.provider_ref))
      .filter((n) => Number.isInteger(n) && n > 0);

    let media: Map<number, AniListMedia>;
    try {
      media = await withRetry(() => fetcher(ids, opts?.signal), deps);
    } catch (err) {
      const code = err instanceof ProviderError ? err.code : "provider_unavailable";
      if (isRetryable(code)) {
        const rel = await a.rpc("import_canonical_v2_release_lock", {
          _batch_id: batchId,
          _claim_token: claimToken,
          _error_code: code,
        });
        if (rel.error) throw new Error(rel.error.message);
        result.releasedRetryable += claimed.length;
        result.chunksProcessed += 1;
        continue;
      }
      const entries = claimed.map((c) => ({
        item_id: c.item_id,
        kind: "failed" as const,
        error_code: "invalid_canonical_payload",
        error_message: (err as Error)?.message?.slice(0, 240) ?? "invalid",
      }));
      await storeChunk(a, batchId, claimToken, entries);
      result.storedFailed += entries.length;
      result.chunksProcessed += 1;
      continue;
    }

    const entries: Array<Record<string, unknown>> = [];
    for (const c of claimed) {
      const n = Number(c.provider_ref);
      const m = Number.isInteger(n) ? media.get(n) : undefined;
      if (!m) {
        entries.push({
          item_id: c.item_id,
          kind: "failed",
          error_code: "provider_not_found",
          error_message: `AniList id ${c.provider_ref} not returned`,
        });
        continue;
      }
      if (m.id !== n) {
        entries.push({
          item_id: c.item_id,
          kind: "failed",
          error_code: "provider_id_mismatch",
          error_message: `expected ${n}, got ${m.id}`,
        });
        continue;
      }
      const snap = buildCanonicalSnapshot(m);
      if (!snap) {
        entries.push({
          item_id: c.item_id,
          kind: "failed",
          error_code: "invalid_canonical_payload",
          error_message: "empty title or bad shape",
        });
        continue;
      }
      entries.push({ item_id: c.item_id, kind: "canonical", snapshot: snap });
    }

    await storeChunk(a, batchId, claimToken, entries);
    result.storedCanonical += entries.filter((e) => e.kind === "canonical").length;
    result.storedFailed += entries.filter((e) => e.kind === "failed").length;
    result.chunksProcessed += 1;
  }

  try {
    const p = await a
      .from("import_canonical_v2_batches")
      .select("status")
      .eq("id", batchId)
      .maybeSingle();
    if (p.data?.status) result.batchStatus = p.data.status;
  } catch {
    /* ignore */
  }
  return result;
}

async function storeChunk(
  a: UserClient,
  batchId: string,
  claimToken: string,
  entries: Array<Record<string, unknown>>,
): Promise<void> {
  const store = await a.rpc("import_canonical_v2_store_chunk", {
    _batch_id: batchId,
    _claim_token: claimToken,
    _entries: entries as unknown as never,
  });
  if (store.error) throw new Error(store.error.message);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  deps: CanonDeps,
  maxAttempts = MAX_ATTEMPTS,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = err instanceof ProviderError ? err.code : "provider_unavailable";
      if (!isRetryable(code)) throw err;
      if (attempt === maxAttempts) break;
      const provided = err instanceof ProviderError ? err.retryAfterMs : undefined;
      const wait = provided ?? jitter(500 * Math.pow(2, attempt - 1));
      await deps.sleep(wait);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("provider_unavailable");
}

// ---------------------------------------------------------------------------
// Test-only seams
// ---------------------------------------------------------------------------

export const __internal = {
  defaultDeps,
  makeDefaultDeps,
  waitForToken,
  buildCanonicalSnapshot,
  safeHttps,
  pickTitle,
  pickReleaseDate,
  pickScore,
  isRetryable,
  withRetry,
  storeChunk,
  MAX_CHUNK_SIZE,
  MAX_ATTEMPTS,
};
