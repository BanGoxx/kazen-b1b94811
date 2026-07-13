import { createServerFn } from "@tanstack/react-start";

// KAZEN one-click unsubscribe — Phase 2 (public, token-authenticated).
//
// Unauthenticated by design: the caller proves intent by presenting a valid
// AES-256-GCM token (see email/unsub-token.server). The token — not a session —
// authorizes flipping the encoded user's digest consent off. No raw user id is
// ever accepted from the client, and the action is idempotent, so link
// prefetching / repeated clicks are safe.

export const processUnsubscribe = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => {
    if (!data || typeof data.token !== "string" || !data.token) {
      throw new Error("Token manquant.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { verifyUnsubToken } = await import("./email/unsub-token.server");
    const payload = verifyUnsubToken(data.token);
    if (!payload) return { ok: false as const, reason: "invalid" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {
      user_id: payload.uid,
      consent_updated_at: new Date().toISOString(),
    };
    if (payload.scope === "general" || payload.scope === "all") {
      patch.receive_general_digest = false;
    }
    if (payload.scope === "personalized" || payload.scope === "all") {
      patch.receive_personalized_digest = false;
    }

    const { error } = await supabaseAdmin
      .from("member_email_preferences")
      .upsert(patch, { onConflict: "user_id" });
    if (error) return { ok: false as const, reason: "error" as const };

    return { ok: true as const, scope: payload.scope };
  });
