import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Phase 10 — Shared-playlist reviews.
// Writes are funneled through SECURITY DEFINER database functions that derive
// the author from auth.uid() and enforce eligibility (public playlist, length,
// rate limit) internally. These server functions are thin, auth-checked
// wrappers — RLS + the DB functions are the real enforcement layer.

export const upsertPlaylistReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { playlistId: string; body: string; rating: number | null }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc(
      "upsert_playlist_review",
      {
        _playlist: data.playlistId,
        _body: data.body,
        _rating: data.rating,
      },
    );
    if (error) throw new Error(error.message);
    return { id };
  });

export const deletePlaylistReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("delete_playlist_review", {
      _id: data.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
