import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

// Public reviews / comments on a fiche. Reads are public (RLS allows anon
// SELECT); writes are scoped to the signed-in user by RLS. We use the browser
// Supabase client directly so signed-out visitors can read and signed-in users
// can write within their own row, without an extra server round-trip.

export interface FicheReview {
  id: string;
  userId: string;
  body: string;
  rating: number | null;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorAvatar: string | null;
}

function reviewsKey(source: string, externalId: string) {
  return ["fiche-reviews", source, externalId] as const;
}

async function fetchReviews(source: string, externalId: string): Promise<FicheReview[]> {
  const { data, error } = await supabase
    .from("fiche_reviews")
    .select("id,user_id,body,rating,created_at,updated_at")
    .eq("media_source", source)
    .eq("media_external_id", externalId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,display_name,avatar_url")
    .in("id", userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((r) => {
    const profile = byId.get(r.user_id);
    return {
      id: r.id,
      userId: r.user_id,
      body: r.body,
      rating: r.rating,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      authorName: profile?.display_name || "Membre KAZEN",
      authorAvatar: profile?.avatar_url ?? null,
    };
  });
}

export function useFicheReviews(source: string, externalId: string) {
  return useQuery({
    queryKey: reviewsKey(source, externalId),
    queryFn: () => fetchReviews(source, externalId),
    staleTime: 30_000,
  });
}

export function useMyReview(source: string, externalId: string): FicheReview | null {
  const { user } = useAuth();
  const { data } = useFicheReviews(source, externalId);
  if (!user) return null;
  return data?.find((r) => r.userId === user.id) ?? null;
}

export function useReviewMutations(source: string, externalId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: reviewsKey(source, externalId) });

  const upsert = useMutation({
    mutationFn: async ({ body, rating }: { body: string; rating: number | null }) => {
      if (!user) throw new Error("not-auth");
      const { error } = await supabase.from("fiche_reviews").upsert(
        {
          user_id: user.id,
          media_source: source,
          media_external_id: externalId,
          body: body.trim(),
          rating,
        },
        { onConflict: "user_id,media_source,media_external_id" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not-auth");
      const { error } = await supabase
        .from("fiche_reviews")
        .delete()
        .eq("user_id", user.id)
        .eq("media_source", source)
        .eq("media_external_id", externalId);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { upsert, remove };
}

// ---------------------------------------------------------------------------
// Likes & réponses (brique communautaire 3)
// ---------------------------------------------------------------------------

export interface ReviewReply {
  id: string;
  reviewId: string;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorAvatar: string | null;
}

async function attachProfiles<T extends { user_id: string }>(rows: T[]) {
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  if (userIds.length === 0) return new Map<string, { display_name: string | null; avatar_url: string | null }>();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,display_name,avatar_url")
    .in("id", userIds);
  return new Map((profiles ?? []).map((p) => [p.id, p]));
}

// --- Likes on a review ------------------------------------------------------

function reviewLikesKey(reviewId: string) {
  return ["review-likes", reviewId] as const;
}

export function useReviewLikes(reviewId: string) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: reviewLikesKey(reviewId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_likes")
        .select("user_id")
        .eq("review_id", reviewId);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.user_id);
    },
    staleTime: 30_000,
  });
  const likers = query.data ?? [];
  return {
    count: likers.length,
    likedByMe: user ? likers.includes(user.id) : false,
    isLoading: query.isLoading,
  };
}

export function useReviewLikeToggle(reviewId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (currentlyLiked: boolean) => {
      if (!user) throw new Error("not-auth");
      if (currentlyLiked) {
        const { error } = await supabase
          .from("review_likes")
          .delete()
          .eq("review_id", reviewId)
          .eq("user_id", user.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("review_likes")
          .insert({ review_id: reviewId, user_id: user.id });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: reviewLikesKey(reviewId) }),
  });
}

// --- Replies on a review ----------------------------------------------------

function repliesKey(reviewId: string) {
  return ["review-replies", reviewId] as const;
}

export function useReviewReplies(reviewId: string) {
  return useQuery({
    queryKey: repliesKey(reviewId),
    queryFn: async (): Promise<ReviewReply[]> => {
      const { data, error } = await supabase
        .from("review_replies")
        .select("id,review_id,user_id,body,created_at,updated_at")
        .eq("review_id", reviewId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const byId = await attachProfiles(rows);
      return rows.map((r) => {
        const p = byId.get(r.user_id);
        return {
          id: r.id,
          reviewId: r.review_id,
          userId: r.user_id,
          body: r.body,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          authorName: p?.display_name || "Membre KAZEN",
          authorAvatar: p?.avatar_url ?? null,
        };
      });
    },
    staleTime: 30_000,
  });
}

export function useReplyMutations(reviewId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () => qc.invalidateQueries({ queryKey: repliesKey(reviewId) });

  const add = useMutation({
    mutationFn: async (body: string) => {
      if (!user) throw new Error("not-auth");
      const { error } = await supabase
        .from("review_replies")
        .insert({ review_id: reviewId, user_id: user.id, body: body.trim() });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      if (!user) throw new Error("not-auth");
      const { error } = await supabase
        .from("review_replies")
        .update({ body: body.trim() })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("not-auth");
      const { error } = await supabase
        .from("review_replies")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { add, update, remove };
}

// --- Likes on a reply -------------------------------------------------------

function replyLikesKey(replyId: string) {
  return ["reply-likes", replyId] as const;
}

export function useReplyLikes(replyId: string) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: replyLikesKey(replyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reply_likes")
        .select("user_id")
        .eq("reply_id", replyId);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.user_id);
    },
    staleTime: 30_000,
  });
  const likers = query.data ?? [];
  return {
    count: likers.length,
    likedByMe: user ? likers.includes(user.id) : false,
  };
}

export function useReplyLikeToggle(replyId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (currentlyLiked: boolean) => {
      if (!user) throw new Error("not-auth");
      if (currentlyLiked) {
        const { error } = await supabase
          .from("reply_likes")
          .delete()
          .eq("reply_id", replyId)
          .eq("user_id", user.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("reply_likes")
          .insert({ reply_id: replyId, user_id: user.id });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: replyLikesKey(replyId) }),
  });
}
