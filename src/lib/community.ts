import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Community discovery data layer.
 *
 * Every read here goes through a SECURITY DEFINER aggregate RPC that returns
 * only public, threshold-gated, moderation-filtered results. No private list
 * activity, progress, chat, notifications or preferences are ever exposed.
 * Rankings are computed server-side from unique-user counts with minimum
 * thresholds, so anonymous or repeated calls cannot manipulate them. Each hook
 * degrades to an empty array, and its UI hides cleanly when there is not enough
 * real community data yet.
 */

const FIVE_MIN = 1000 * 60 * 5;

export interface TrendingTitle {
  media_key: string;
  title: string;
  poster_url: string | null;
  media_type: string | null;
  source: string;
  external_id: string;
  genres: string[] | null;
  member_count: number;
}

export interface HelpfulReview {
  id: string;
  body: string;
  rating: number | null;
  media_source: string;
  media_external_id: string;
  media_title: string | null;
  media_poster_url: string | null;
  author_display_name: string;
  helpful_votes: number;
  created_at: string;
}

export interface GenreTrend {
  genre: string;
  member_count: number;
}

export interface CommunityContributor {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  badge_label: string;
  visual_variant: string | null;
  icon_key: string | null;
  assigned_at: string;
}

export function useTrendingTitles(limit = 12) {
  return useQuery({
    queryKey: ["community", "trending-titles", limit],
    staleTime: FIVE_MIN,
    queryFn: async (): Promise<TrendingTitle[]> => {
      const { data, error } = await supabase.rpc("get_community_trending_titles", {
        p_days: 30,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as TrendingTitle[];
    },
  });
}

export function useHelpfulReviews(limit = 6) {
  return useQuery({
    queryKey: ["community", "helpful-reviews", limit],
    staleTime: FIVE_MIN,
    queryFn: async (): Promise<HelpfulReview[]> => {
      const { data, error } = await supabase.rpc("get_community_helpful_reviews", {
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as HelpfulReview[];
    },
  });
}

export function useGenreTrends(limit = 8) {
  return useQuery({
    queryKey: ["community", "genre-trends", limit],
    staleTime: FIVE_MIN,
    queryFn: async (): Promise<GenreTrend[]> => {
      const { data, error } = await supabase.rpc("get_community_genre_trends", {
        p_days: 30,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as GenreTrend[];
    },
  });
}

export function useCommunityContributors(limit = 12) {
  return useQuery({
    queryKey: ["community", "contributors", limit],
    staleTime: FIVE_MIN,
    queryFn: async (): Promise<CommunityContributor[]> => {
      const { data, error } = await supabase.rpc("get_community_contributors", {
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as CommunityContributor[];
    },
  });
}
