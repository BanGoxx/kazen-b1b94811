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

      return {
        meta: mapMeta(pl),
        ownerName: profile?.display_name || "Membre KAZEN",
        ownerAvatar: profile?.avatar_url ?? null,
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
      const patch: Record<string, unknown> = {};
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
