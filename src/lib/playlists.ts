import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { snapshotFromItem } from "./list.functions";
import type {
  MediaItem,
  MediaSource,
  MediaType,
  Platform,
} from "./media-types";

// Playlists partagées (brique communautaire 4).
// Lectures publiques (RLS autorise anon sur les playlists publiques) via le
// client navigateur ; écritures limitées au propriétaire par RLS.

export interface PlaylistMeta {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistItem {
  id: string;
  mediaKey: string;
  note: string;
  position: number;
  item: MediaItem | null;
}

interface MediaRecordRow {
  media_key: string;
  source: string;
  external_id: string;
  media_type: string;
  title: string;
  title_original: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  release_date: string | null;
  genres: string[] | null;
  score: number | null;
  platforms: unknown;
}

function rowToMediaItem(rec: MediaRecordRow): MediaItem {
  return {
    key: rec.media_key,
    source: rec.source as MediaSource,
    externalId: rec.external_id,
    mediaType: rec.media_type as MediaType,
    title: rec.title,
    titleOriginal: rec.title_original,
    synopsis: null,
    posterUrl: rec.poster_url,
    backdropUrl: rec.backdrop_url,
    genres: rec.genres ?? [],
    score: rec.score,
    status: null,
    releaseDate: rec.release_date,
    nextEpisode: null,
    episodesCount: null,
    seasonsCount: null,
    runtime: null,
    platforms: (rec.platforms as Platform[] | null) ?? [],
  };
}

function mapMeta(row: {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}): PlaylistMeta {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- My playlists -----------------------------------------------------------

export function useMyPlaylists() {
  const { user, ready } = useAuth();
  return useQuery({
    queryKey: ["my-playlists", user?.id],
    enabled: ready && Boolean(user),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("id,owner_id,title,description,is_public,created_at,updated_at,playlist_items(id)")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        ...mapMeta(row),
        count: Array.isArray(row.playlist_items) ? row.playlist_items.length : 0,
      }));
    },
  });
}

// --- Single playlist (public read) ------------------------------------------

export interface PlaylistDetail {
  meta: PlaylistMeta;
  items: PlaylistItem[];
  ownerName: string;
  ownerAvatar: string | null;
  likeCount: number;
}

export function usePlaylist(id: string) {
  return useQuery({
    queryKey: ["playlist", id],
    staleTime: 30_000,
    queryFn: async (): Promise<PlaylistDetail | null> => {
      const { data: pl, error } = await supabase
        .from("playlists")
        .select("id,owner_id,title,description,is_public,created_at,updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!pl) return null;

      const { data: items, error: itemsError } = await supabase
        .from("playlist_items")
        .select("id,media_key,note,position,media_records(*)")
        .eq("playlist_id", id)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (itemsError) throw new Error(itemsError.message);

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name,avatar_url")
        .eq("id", pl.owner_id)
        .maybeSingle();

      const { count: likeCount } = await supabase
        .from("playlist_likes")
        .select("id", { count: "exact", head: true })
        .eq("playlist_id", id);

      return {
        meta: mapMeta(pl),
        ownerName: profile?.display_name || "Membre KAZEN",
        ownerAvatar: profile?.avatar_url ?? null,
        likeCount: likeCount ?? 0,
        items: (items ?? []).map((row) => ({
          id: row.id,
          mediaKey: row.media_key,
          note: row.note,
          position: row.position,
          item: row.media_records
            ? rowToMediaItem(row.media_records as unknown as MediaRecordRow)
            : null,
        })),
      };
    },
  });
}

// --- Discovery (public shared lists) ----------------------------------------

export interface PublicPlaylistCard {
  id: string;
  title: string;
  description: string;
  ownerName: string;
  ownerAvatar: string | null;
  count: number;
  likeCount: number;
  posters: string[];
  updatedAt: string;
  createdAt: string;
}

/**
 * Public discovery of shared lists. Reads only public playlists (RLS enforces
 * this too) and returns lightweight cards with a few poster previews plus a
 * like count, ordered by a simple recency + popularity blend.
 */
export function usePublicPlaylists() {
  return useQuery({
    queryKey: ["public-playlists"],
    staleTime: 60_000,
    queryFn: async (): Promise<{ recent: PublicPlaylistCard[]; popular: PublicPlaylistCard[] }> => {
      const { data, error } = await supabase
        .from("playlists")
        .select(
          "id,owner_id,title,description,created_at,updated_at,playlist_items(media_records(poster_url))",
        )
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(60);
      if (error) throw new Error(error.message);

      const rows = data ?? [];
      const ownerIds = [...new Set(rows.map((r) => r.owner_id))];

      const [{ data: profiles }, { data: likes }] = await Promise.all([
        ownerIds.length
          ? supabase.from("profiles").select("id,display_name,avatar_url").in("id", ownerIds)
          : Promise.resolve({
              data: [] as { id: string; display_name: string | null; avatar_url: string | null }[],
            }),
        supabase.from("playlist_likes").select("playlist_id"),
      ]);

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const likeMap = new Map<string, number>();
      for (const l of likes ?? []) {
        likeMap.set(l.playlist_id, (likeMap.get(l.playlist_id) ?? 0) + 1);
      }

      const cards: PublicPlaylistCard[] = rows
        .map((row) => {
          const rawItems = Array.isArray(row.playlist_items) ? row.playlist_items : [];
          const posters = rawItems
            .map(
              (i) =>
                (i.media_records as unknown as { poster_url: string | null } | null)?.poster_url ??
                null,
            )
            .filter((p): p is string => Boolean(p))
            .slice(0, 4);
          const prof = profileMap.get(row.owner_id);
          return {
            id: row.id,
            title: row.title,
            description: row.description,
            ownerName: prof?.display_name || "Membre KAZEN",
            ownerAvatar: prof?.avatar_url ?? null,
            count: rawItems.length,
            likeCount: likeMap.get(row.id) ?? 0,
            posters,
            updatedAt: row.updated_at,
            createdAt: row.created_at,
          };
        })
        // Hide empty lists from public discovery for a curated feel.
        .filter((c) => c.count >= 1);

      const recent = cards.slice(0, 24);
      const popular = [...cards]
        .filter((c) => c.likeCount > 0 || c.count >= 3)
        .sort((a, b) => {
          const score = (c: PublicPlaylistCard) => {
            const ageDays = (Date.now() - new Date(c.updatedAt).getTime()) / 86_400_000;
            const recencyBoost = Math.max(0, 14 - ageDays) / 14; // 0..1 over 2 weeks
            return c.likeCount * 3 + Math.min(c.count, 20) * 0.4 + recencyBoost * 2;
          };
          return score(b) - score(a);
        })
        .slice(0, 12);

      return { recent, popular };
    },
  });
}

// --- Likes ------------------------------------------------------------------

export function usePlaylistLike(playlistId: string) {
  const { user, ready } = useAuth();
  const qc = useQueryClient();

  const liked = useQuery({
    queryKey: ["playlist-like", playlistId, user?.id],
    enabled: ready && Boolean(user),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlist_likes")
        .select("id")
        .eq("playlist_id", playlistId)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
  });

  const toggle = useMutation({
    mutationFn: async (currentlyLiked: boolean) => {
      if (!user) throw new Error("not-auth");
      if (currentlyLiked) {
        const { error } = await supabase
          .from("playlist_likes")
          .delete()
          .eq("playlist_id", playlistId)
          .eq("user_id", user.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("playlist_likes")
          .insert({ playlist_id: playlistId, user_id: user.id });
        if (error && !error.message.includes("duplicate")) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlist-like", playlistId] });
      qc.invalidateQueries({ queryKey: ["playlist", playlistId] });
      qc.invalidateQueries({ queryKey: ["public-playlists"] });
    },
  });

  return { liked: liked.data ?? false, toggle, canLike: Boolean(user) };
}

// --- Mutations --------------------------------------------------------------

export function usePlaylistMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidateMine = () => qc.invalidateQueries({ queryKey: ["my-playlists"] });

  const create = useMutation({
    mutationFn: async (input: { title: string; description?: string; isPublic?: boolean }) => {
      if (!user) throw new Error("not-auth");
      const { data, error } = await supabase
        .from("playlists")
        .insert({
          owner_id: user.id,
          title: input.title.trim(),
          description: input.description?.trim() ?? "",
          is_public: input.isPublic ?? true,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    },
    onSuccess: invalidateMine,
  });

  const update = useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      description?: string;
      isPublic?: boolean;
    }) => {
      if (!user) throw new Error("not-auth");
      const patch: { title?: string; description?: string; is_public?: boolean } = {};
      if (input.title !== undefined) patch.title = input.title.trim();
      if (input.description !== undefined) patch.description = input.description.trim();
      if (input.isPublic !== undefined) patch.is_public = input.isPublic;
      const { error } = await supabase
        .from("playlists")
        .update(patch)
        .eq("id", input.id)
        .eq("owner_id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => {
      invalidateMine();
      qc.invalidateQueries({ queryKey: ["playlist", vars.id] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("not-auth");
      const { error } = await supabase
        .from("playlists")
        .delete()
        .eq("id", id)
        .eq("owner_id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidateMine,
  });

  const addItem = useMutation({
    mutationFn: async (input: { playlistId: string; item: MediaItem; note?: string }) => {
      if (!user) throw new Error("not-auth");
      const snap = snapshotFromItem(input.item);
      // Ensure a media snapshot exists; ignore if already present.
      await supabase.from("media_records").upsert(
        {
          media_key: snap.key,
          source: snap.source,
          external_id: snap.externalId,
          media_type: snap.mediaType,
          title: snap.title,
          title_original: snap.titleOriginal,
          poster_url: snap.posterUrl,
          backdrop_url: snap.backdropUrl,
          release_date: snap.releaseDate,
          genres: snap.genres,
          platforms: snap.platforms as never,
          score: snap.score,
        },
        { onConflict: "media_key", ignoreDuplicates: true },
      );
      const { error } = await supabase.from("playlist_items").insert({
        playlist_id: input.playlistId,
        media_key: snap.key,
        note: input.note?.trim() ?? "",
      });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => {
      invalidateMine();
      qc.invalidateQueries({ queryKey: ["playlist", vars.playlistId] });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (input: { playlistId: string; mediaKey: string }) => {
      if (!user) throw new Error("not-auth");
      const { error } = await supabase
        .from("playlist_items")
        .delete()
        .eq("playlist_id", input.playlistId)
        .eq("media_key", input.mediaKey);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => {
      invalidateMine();
      qc.invalidateQueries({ queryKey: ["playlist", vars.playlistId] });
    },
  });

  return { create, update, remove, addItem, removeItem };
}
