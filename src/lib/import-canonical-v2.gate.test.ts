// KAZEN — Phase G.5 non-regression tests for the V1/V2 gate.
//
// Locks the exact RPC name called by `evaluateCanonicalV2Gate` and its
// fail-closed behavior. Prevents future regressions of the G.4 bug where
// the gate incorrectly called the service_role-only helper
// `import_canonical_v2__is_enabled_for_user(uuid)`, which authenticated
// users are denied EXECUTE on — making the gate return `false` for
// everyone including allowlisted users.

import { describe, it, expect, vi } from "vitest";
import {
  evaluateCanonicalV2Gate,
  CANONICAL_V2_GATE_RPC,
  type CanonicalV2GateSupabase,
} from "./import-canonical-v2.functions";

function makeSupabase(
  impl: (fn: string, args?: Record<string, unknown>) => { data: unknown; error: unknown },
) {
  const rpc = vi.fn(async (fn: string, args?: Record<string, unknown>) => impl(fn, args));
  return { supabase: { rpc } as CanonicalV2GateSupabase, rpc };
}

describe("Canonicalization V2 gate — non-regression", () => {
  it("RPC name is exactly 'import_canonical_v2_is_enabled'", () => {
    expect(CANONICAL_V2_GATE_RPC).toBe("import_canonical_v2_is_enabled");
  });

  it("case 1 — allowlisted authenticated user → enabled=true", async () => {
    const { supabase, rpc } = makeSupabase(() => ({ data: true, error: null }));
    await expect(evaluateCanonicalV2Gate(supabase)).resolves.toEqual({ enabled: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("import_canonical_v2_is_enabled");
  });

  it("case 2 — authenticated but not allowlisted → enabled=false", async () => {
    const { supabase } = makeSupabase(() => ({ data: false, error: null }));
    await expect(evaluateCanonicalV2Gate(supabase)).resolves.toEqual({ enabled: false });
  });

  it("case 3 — global flag false → enabled=false", async () => {
    const { supabase } = makeSupabase(() => ({ data: false, error: null }));
    await expect(evaluateCanonicalV2Gate(supabase)).resolves.toEqual({ enabled: false });
  });

  it("case 4 — RPC error → fail closed (enabled=false)", async () => {
    const { supabase } = makeSupabase(() => ({
      data: null,
      error: { code: "42501", message: "permission denied" },
    }));
    await expect(evaluateCanonicalV2Gate(supabase)).resolves.toEqual({ enabled: false });
  });

  it("case 5 — never calls the service_role-only helper", async () => {
    const forbidden = "import_canonical_v2__is_enabled_for_user";
    const { supabase, rpc } = makeSupabase((fn) => {
      if (fn === forbidden) throw new Error(`must never call ${forbidden}`);
      return { data: true, error: null };
    });
    await evaluateCanonicalV2Gate(supabase);
    for (const call of rpc.mock.calls) {
      expect(call[0]).not.toBe(forbidden);
      expect(call[0]).toBe("import_canonical_v2_is_enabled");
    }
  });

  it("case 6 — no client-supplied user_id is passed to the RPC", async () => {
    const { supabase, rpc } = makeSupabase(() => ({ data: true, error: null }));
    await evaluateCanonicalV2Gate(supabase);
    // Either called with no second arg, or with an object that does NOT
    // carry a user_id / _user_id key. The DB gate reads auth.uid() itself.
    const args = rpc.mock.calls[0][1];
    if (args !== undefined) {
      expect(args).not.toHaveProperty("user_id");
      expect(args).not.toHaveProperty("_user_id");
    }
  });

  it("case 7 — coerces truthy/falsy data to strict boolean", async () => {
    const truthy = makeSupabase(() => ({ data: 1 as unknown, error: null }));
    await expect(evaluateCanonicalV2Gate(truthy.supabase)).resolves.toEqual({ enabled: true });
    const falsy = makeSupabase(() => ({ data: null as unknown, error: null }));
    await expect(evaluateCanonicalV2Gate(falsy.supabase)).resolves.toEqual({ enabled: false });
  });
});
