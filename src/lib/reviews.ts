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
