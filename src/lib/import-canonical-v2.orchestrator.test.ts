// Mocked orchestration tests for V2 processor. No network, no DB.
import { describe, it, expect } from "vitest";
import {
  buildAuthContext,
  processCanonicalBatchV2,
  ProviderError,
  __internal,
  type AuthContext,
  type CanonDeps,
} from "./import-canonical-v2.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type UserClient = SupabaseClient<Database>;

// Minimal Supabase-shaped mock. We only implement the paths the orchestrator
// actually calls: `.rpc(name, args)` and `.from(t).select(...).eq(...).maybeSingle()`.
interface Call {
  fn: string;
  args?: Record<string, unknown>;
}

interface MockOptions {
  enabled?: boolean;
  ownerId?: string;
  batchId?: string;
  onRpc?: (fn: string, args: Record<string, unknown>) => { data?: unknown; error?: unknown };
}

function makeMock(opts: MockOptions): { client: UserClient; calls: Call[] } {
  const calls: Call[] = [];
  const client = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "import_canonical_v2__is_enabled_for_user") {
        return Promise.resolve({ data: opts.enabled ?? true, error: null });
      }
      if (opts.onRpc) return Promise.resolve(opts.onRpc(fn, args));
      return Promise.resolve({ data: null, error: null });
    },
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, val: string) => ({
          maybeSingle: () =>
            Promise.resolve({
              data:
                opts.batchId && val === opts.batchId
                  ? { id: opts.batchId, user_id: opts.ownerId ?? "USER_A", status: "pending" }
                  : null,
              error: null,
            }),
        }),
      }),
    }),
  } as unknown as UserClient;
  return { client, calls };
}

function makeDeps(overrides?: Partial<CanonDeps>): CanonDeps {
  const d = __internal.makeDefaultDeps();
  d.sleep = async () => {};
  return { ...d, ...overrides };
}

function ctxFor(client: UserClient, userId = "USER_A"): AuthContext {
  return buildAuthContext(client, userId);
}

describe("orchestrator — ownership + flag", () => {
  it("throws feature_disabled when flag is off", async () => {
    const { client } = makeMock({ enabled: false, ownerId: "USER_A", batchId: "B1" });
    const deps = makeDeps({ admin: async () => client });
    await expect(processCanonicalBatchV2(ctxFor(client), "B1", { deps })).rejects.toThrow(
      /feature_disabled/,
    );
  });

  it("throws batch_not_found for an unknown batch", async () => {
    const { client } = makeMock({ enabled: true, ownerId: "USER_A", batchId: "OTHER" });
    const deps = makeDeps({ admin: async () => client });
    await expect(processCanonicalBatchV2(ctxFor(client), "B1", { deps })).rejects.toThrow(
      /batch_not_found/,
    );
  });

  it("throws forbidden when batch is owned by a different user", async () => {
    const { client } = makeMock({ enabled: true, ownerId: "SOMEONE_ELSE", batchId: "B1" });
    const deps = makeDeps({ admin: async () => client });
    await expect(processCanonicalBatchV2(ctxFor(client, "USER_A"), "B1", { deps })).rejects.toThrow(
      /forbidden/,
    );
  });

  it("rejects a forged AuthContext (missing brand)", async () => {
    const { client } = makeMock({ enabled: true, ownerId: "USER_A", batchId: "B1" });
    const deps = makeDeps({ admin: async () => client });
    const forged = { supabase: client, userId: "USER_A" } as unknown as AuthContext;
    await expect(processCanonicalBatchV2(forged, "B1", { deps })).rejects.toThrow(
      /invalid_auth_context/,
    );
  });
});

describe("orchestrator — no admin calls until ownership verified", () => {
  it("when ownership fails, no worker RPC is issued", async () => {
    const rpcCalls: string[] = [];
    const { client } = makeMock({
      enabled: true,
      ownerId: "OTHER",
      batchId: "B1",
      onRpc: (fn) => {
        rpcCalls.push(fn);
        return { data: null, error: null };
      },
    });
    const deps = makeDeps({ admin: async () => client });
    await expect(processCanonicalBatchV2(ctxFor(client), "B1", { deps })).rejects.toThrow();
    // `is_enabled_for_user` runs before ownership; the WORKER RPCs must not.
    expect(rpcCalls).not.toContain("import_canonical_v2_claim_chunk");
    expect(rpcCalls).not.toContain("import_canonical_v2_store_chunk");
    expect(rpcCalls).not.toContain("import_canonical_v2_release_lock");
  });
});

describe("orchestrator — claim → store happy path", () => {
  it("stores canonical entries from a successful fetcher", async () => {
    let claimCalls = 0;
    const { client } = makeMock({
      enabled: true,
      ownerId: "USER_A",
      batchId: "B1",
      onRpc: (fn) => {
        if (fn === "import_canonical_v2_claim_chunk") {
          claimCalls += 1;
          if (claimCalls === 1) {
            return {
              data: [
                { item_id: "i1", provider_ref: "21", claim_token: "T", attempts: 1 },
                { item_id: "i2", provider_ref: "22", claim_token: "T", attempts: 1 },
              ],
              error: null,
            };
          }
          return { data: [], error: null };
        }
        if (fn === "import_canonical_v2_store_chunk") return { data: null, error: null };
        return { data: null, error: null };
      },
    });
    const deps = makeDeps({ admin: async () => client });
    const fetcher = async (ids: number[]) => {
      const m = new Map();
      for (const id of ids)
        m.set(id, { id, title: { english: `T${id}` }, averageScore: 87 });
      return m;
    };
    const out = await processCanonicalBatchV2(ctxFor(client), "B1", { deps, fetcher, maxChunks: 3 });
    expect(out.storedCanonical).toBe(2);
    expect(out.storedFailed).toBe(0);
    expect(out.releasedRetryable).toBe(0);
    expect(out.done).toBe(true);
  });
});

describe("orchestrator — retryable errors release lock (no wait held)", () => {
  it("release_lock is called with retryable code, no store_chunk with canonical entries", async () => {
    const fns: string[] = [];
    let claimCalls = 0;
    const { client } = makeMock({
      enabled: true,
      ownerId: "USER_A",
      batchId: "B1",
      onRpc: (fn) => {
        fns.push(fn);
        if (fn === "import_canonical_v2_claim_chunk") {
          claimCalls += 1;
          if (claimCalls === 1) {
            return {
              data: [{ item_id: "i1", provider_ref: "21", claim_token: "T", attempts: 1 }],
              error: null,
            };
          }
          return { data: [], error: null };
        }
        return { data: null, error: null };
      },
    });
    const deps = makeDeps({ admin: async () => client });
    const fetcher = async () => {
      throw new ProviderError("provider_timeout");
    };
    const out = await processCanonicalBatchV2(ctxFor(client), "B1", { deps, fetcher });
    expect(out.releasedRetryable).toBe(1);
    expect(fns).toContain("import_canonical_v2_release_lock");
    expect(fns).not.toContain("import_canonical_v2_store_chunk");
  });
});

describe("orchestrator — 429 → release_lock with provider_rate_limited", () => {
  it("propagates the 429 classification", async () => {
    const captured: Record<string, unknown>[] = [];
    let claimCalls = 0;
    const { client } = makeMock({
      enabled: true,
      ownerId: "USER_A",
      batchId: "B1",
      onRpc: (fn, args) => {
        if (fn === "import_canonical_v2_release_lock") captured.push(args);
        if (fn === "import_canonical_v2_claim_chunk") {
          claimCalls += 1;
          if (claimCalls === 1)
            return {
              data: [{ item_id: "i1", provider_ref: "21", claim_token: "T", attempts: 1 }],
              error: null,
            };
          return { data: [], error: null };
        }
        return { data: null, error: null };
      },
    });
    const deps = makeDeps({ admin: async () => client });
    const fetcher = async () => {
      throw new ProviderError("provider_rate_limited", "429", 1000);
    };
    await processCanonicalBatchV2(ctxFor(client), "B1", { deps, fetcher });
    expect(captured[0]?._error_code).toBe("provider_rate_limited");
  });
});

describe("orchestrator — terminal fetch error → failed entries via store_chunk", () => {
  it("marks all claimed items failed with invalid_canonical_payload", async () => {
    let claimCalls = 0;
    let stored: unknown = null;
    const { client } = makeMock({
      enabled: true,
      ownerId: "USER_A",
      batchId: "B1",
      onRpc: (fn, args) => {
        if (fn === "import_canonical_v2_store_chunk") stored = args._entries;
        if (fn === "import_canonical_v2_claim_chunk") {
          claimCalls += 1;
          if (claimCalls === 1)
            return {
              data: [
                { item_id: "i1", provider_ref: "21", claim_token: "T", attempts: 1 },
                { item_id: "i2", provider_ref: "22", claim_token: "T", attempts: 1 },
              ],
              error: null,
            };
          return { data: [], error: null };
        }
        return { data: null, error: null };
      },
    });
    const deps = makeDeps({ admin: async () => client });
    const fetcher = async () => {
      throw new ProviderError("invalid_canonical_payload", "bad shape");
    };
    const out = await processCanonicalBatchV2(ctxFor(client), "B1", { deps, fetcher });
    expect(out.storedFailed).toBe(2);
    expect(Array.isArray(stored)).toBe(true);
    expect((stored as Array<{ kind: string }>).every((e) => e.kind === "failed")).toBe(true);
  });
});

describe("orchestrator — provider not found / id mismatch → per-item failed", () => {
  it("emits per-item failed entries for missing or mismatched ids", async () => {
    let claimCalls = 0;
    let stored: Array<{ item_id: string; kind: string; error_code?: string }> = [];
    const { client } = makeMock({
      enabled: true,
      ownerId: "USER_A",
      batchId: "B1",
      onRpc: (fn, args) => {
        if (fn === "import_canonical_v2_store_chunk")
          stored = args._entries as typeof stored;
        if (fn === "import_canonical_v2_claim_chunk") {
          claimCalls += 1;
          if (claimCalls === 1)
            return {
              data: [
                { item_id: "i1", provider_ref: "21", claim_token: "T", attempts: 1 },
                { item_id: "i2", provider_ref: "22", claim_token: "T", attempts: 1 },
              ],
              error: null,
            };
          return { data: [], error: null };
        }
        return { data: null, error: null };
      },
    });
    const deps = makeDeps({ admin: async () => client });
    const fetcher = async () => {
      // return media for 21 only; 22 will be provider_not_found
      const m = new Map();
      m.set(21, { id: 21, title: { english: "OK" }, averageScore: 87 });
      return m;
    };
    const out = await processCanonicalBatchV2(ctxFor(client), "B1", { deps, fetcher });
    expect(out.storedCanonical).toBe(1);
    expect(out.storedFailed).toBe(1);
    const failed = stored.find((e) => e.kind === "failed");
    expect(failed?.error_code).toBe("provider_not_found");
  });
});

describe("orchestrator — error messages never leak secrets", () => {
  it("does not include env-like tokens in Error.message paths", async () => {
    const { client } = makeMock({
      enabled: true,
      ownerId: "USER_A",
      batchId: "B1",
      onRpc: (fn) => {
        if (fn === "import_canonical_v2_claim_chunk")
          return { data: null, error: { message: "boom" } };
        return { data: null, error: null };
      },
    });
    const deps = makeDeps({ admin: async () => client });
    try {
      await processCanonicalBatchV2(ctxFor(client), "B1", { deps });
    } catch (e) {
      expect((e as Error).message).not.toMatch(/sb_secret_|service_role|SUPABASE_/);
    }
  });
});
