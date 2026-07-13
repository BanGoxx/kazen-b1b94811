import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import {
  upsertPlaylistReview,
  deletePlaylistReview,
} from "./playlist-reviews.functions";

// Phase 10 — Shared-playlist reviews (reads).
// Reads go through the browser client under RLS: anyone may read reviews of a
// visible public playlist; a member always sees their own; moderators see all.
// Writes are server functions (see playlist-reviews.functions.ts).

export const PLAYLIST_REVIEWS_PAGE = 10;

export interface PlaylistReview {
  id: string;
  playlistId: string;
  authorId: string;
  body: string;
  rating: number | null;
  createdAt: string;
  editedAt: string | null;
  hidden: boolean;
  authorName: string;
  authorAvatar: string | null;
}

function reviewsKey(playlistId: string) {
  return ["playlist-reviews", playlistId] as const;
}

async function fetchReviews(playlistId: string): Promise<PlaylistReview[]> {
  const { data, error } = await supabase
    .from("shared_playlist_reviews")
    .select("id,playlist_id,author_id,body,rating,created_at,edited_at,hidden_at")
    .eq("playlist_id", playlistId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const userIds = Array.from(new Set(rows.map((r) => r.author_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,display_name,avatar_url")
    .in("id", userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((r) => {
    const profile = byId.get(r.author_id);
    return {
      id: r.id,
      playlistId: r.playlist_id,
      authorId: r.author_id,
      body: r.body,
      rating: r.rating,
      createdAt: r.created_at,
      editedAt: r.edited_at,
      hidden: Boolean(r.hidden_at),
      authorName: profile?.display_name || "Membre KAZEN",
      authorAvatar: profile?.avatar_url ?? null,
    };
  });
}

export function usePlaylistReviews(playlistId: string) {
  return useQuery({
    queryKey: reviewsKey(playlistId),
    queryFn: () => fetchReviews(playlistId),
    staleTime: 30_000,
  });
}

export function useMyPlaylistReview(playlistId: string): PlaylistReview | null {
  const { user } = useAuth();
  const { data } = usePlaylistReviews(playlistId);
  if (!user) return null;
  return data?.find((r) => r.authorId === user.id) ?? null;
}

export function usePlaylistReviewMutations(playlistId: string) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertPlaylistReview);
  const deleteFn = useServerFn(deletePlaylistReview);
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: reviewsKey(playlistId) });

  const upsert = useMutation({
    mutationFn: (input: { body: string; rating: number | null }) =>
      upsertFn({
        data: {
          playlistId,
          body: input.body.trim(),
          rating: input.rating,
        },
      }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: invalidate,
  });

  return { upsert, remove };
}
