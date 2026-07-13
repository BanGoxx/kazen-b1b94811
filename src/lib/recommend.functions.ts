// KAZEN recommendation feedback — server functions.
//
// Stores lightweight, per-member feedback ("pas intéressé" / masqué) so the
// recommendation rails can stop resurfacing titles the member dismissed.
// Everything is scoped to auth.uid() via RLS; the aggregate stats function is
// owner/moderator-only (guarded inside the security-definer SQL function).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RecoFeedbackAction = "hidden" | "not_interested";

export interface RecoFeedbackEntry {
  mediaKey: string;
  action: RecoFeedbackAction;
}

/** Returns the current member's dismissed titles. */
export const getMyRecoFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecoFeedbackEntry[]> => {
    const { data, error } = await context.supabase
      .from("recommendation_feedback")
      .select("media_key, action")
      .eq("user_id", context.userId);

    if (error || !data) return [];
    return data.map((r) => ({
      mediaKey: r.media_key,
      action: (r.action as RecoFeedbackAction) ?? "hidden",
    }));
  });

/** Dismisses a title from the member's recommendations (idempotent upsert). */
export const addRecoFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mediaKey: string; action?: RecoFeedbackAction }) => {
    const key = String(input.mediaKey ?? "").trim();
    if (!key) throw new Error("Titre invalide.");
    const action: RecoFeedbackAction =
      input.action === "not_interested" ? "not_interested" : "hidden";
    return { mediaKey: key, action };
  })
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("recommendation_feedback").upsert(
      {
        user_id: context.userId,
        media_key: data.mediaKey,
        action: data.action,
      } as never,
      { onConflict: "user_id,media_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Restores a previously dismissed title. */
export const removeRecoFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mediaKey: string }) => {
    const key = String(input.mediaKey ?? "").trim();
    if (!key) throw new Error("Titre invalide.");
    return { mediaKey: key };
  })
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("recommendation_feedback")
      .delete()
      .eq("user_id", context.userId)
      .eq("media_key", data.mediaKey);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface RecoFeedbackStat {
  action: RecoFeedbackAction;
  total: number;
  distinctMedia: number;
}

/** Owner/moderator-only aggregate diagnostics (no per-user data exposed). */
export const getRecoFeedbackStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecoFeedbackStat[]> => {
    const { data, error } = await context.supabase.rpc("reco_feedback_stats");
    if (error || !data) return [];
    return (data as { action: string; total: number; distinct_media: number }[]).map((r) => ({
      action: (r.action as RecoFeedbackAction) ?? "hidden",
      total: Number(r.total ?? 0),
      distinctMedia: Number(r.distinct_media ?? 0),
    }));
  });
