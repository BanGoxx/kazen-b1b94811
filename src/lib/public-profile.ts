import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PublicProfile = {
  exists: boolean;
  hidden?: boolean;
  is_self?: boolean;
  id?: string;
  display_name?: string;
  avatar_url?: string | null;
  bio?: string | null;
  member_since?: string;
  show_bio?: boolean;
  show_playlists?: boolean;
  show_reviews?: boolean;
  show_favorites?: boolean;
  show_stats?: boolean;
  playlists_count?: number | null;
  reviews_count?: number | null;
  favorites_count?: number | null;
  chat_eligible?: boolean;
  is_blocked_by_me?: boolean;
};

export type PublicFavorite = {
  media_key: string;
  source: string | null;
  external_id: string | null;
  media_type: string | null;
  title: string | null;
  poster_url: string | null;
};

/** Public, viewer-aware profile summary. Safe for signed-out visitors. */
export function usePublicProfile(id: string | undefined) {
  return useQuery({
    queryKey: ["public-profile", id],
    enabled: !!id,
    staleTime: 60_000,
    queryFn: async (): Promise<PublicProfile> => {
      const { data, error } = await supabase.rpc("get_public_profile", {
        _id: id as string,
      });
      if (error) throw new Error(error.message);
      return (data as unknown as PublicProfile) ?? { exists: false };
    },
  });
}

/** Favorites are private; only returned when the owner opted in server-side. */
export function usePublicFavorites(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["public-favorites", id],
    enabled: !!id && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<PublicFavorite[]> => {
      const { data, error } = await supabase.rpc("get_public_favorites", {
        _id: id as string,
      });
      if (error) throw new Error(error.message);
      return (data as unknown as PublicFavorite[]) ?? [];
    },
  });
}

/** Block / unblock a member. Also prevents chat requests both ways. */
export function useMemberBlock(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (blocked: boolean) => {
      const { error } = await supabase.rpc("set_member_block", {
        _target: id as string,
        _blocked: blocked,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-profile", id] });
    },
  });
}
