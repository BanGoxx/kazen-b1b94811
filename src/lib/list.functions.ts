import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MediaItem, PriorityLevel, WatchStatus } from "./media-types";

// Media snapshot persisted alongside a personal list entry so lists render
// without re-hitting external APIs.
export interface MediaSnapshot {
  key: string;
  source: string;
  externalId: string;
  mediaType: string;
  title: string;
  titleOriginal: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  genres: string[];
  platforms: unknown;
  score: number | null;
}

export interface ListPatch {
  status?: WatchStatus | null;
  favorite?: boolean;
  priority?: PriorityLevel;
  rating?: number | null;
  notes?: string;
  tags?: string[];
  progress?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  rewatch_count?: number;
  is_rewatching?: boolean;
}

export function snapshotFromItem(item: MediaItem): MediaSnapshot {
  return {
    key: item.key,
    source: item.source,
    externalId: item.externalId,
    mediaType: item.mediaType,
    title: item.title,
    titleOriginal: item.titleOriginal,
    posterUrl: item.posterUrl,
    backdropUrl: item.backdropUrl,
    releaseDate: item.releaseDate,
    genres: item.genres,
    platforms: item.platforms,
    score: item.score,
  };
}

export const getMyList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("list_items")
      .select(
        "media_key,status,favorite,priority,rating,notes,tags,progress,started_at,completed_at,rewatch_count,is_rewatching,updated_at,media_records(*)",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertListItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { media: MediaSnapshot; patch: ListPatch }) => data)
  .handler(async ({ data, context }) => {
    const m = data.media;
    const { error: mediaError } = await context.supabase.from("media_records").upsert(
      {
        media_key: m.key,
        source: m.source,
        external_id: m.externalId,
        media_type: m.mediaType,
        title: m.title,
        title_original: m.titleOriginal,
        poster_url: m.posterUrl,
        backdrop_url: m.backdropUrl,
        release_date: m.releaseDate,
        genres: m.genres,
        platforms: m.platforms as never,
        score: m.score,
      },
      { onConflict: "media_key" },
    );
    if (mediaError) throw new Error(mediaError.message);

    const { error } = await context.supabase.from("list_items").upsert(
      {
        user_id: context.userId,
        media_key: m.key,
        ...data.patch,
      },
      { onConflict: "user_id,media_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeListItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { mediaKey: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("list_items")
      .delete()
      .eq("media_key", data.mediaKey);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Reads the owner's own full profile (incl. private preference fields).
    // Direct SELECT on those columns is revoked at the DB level; the
    // get_my_profile() SECURITY DEFINER RPC returns the owner's own row only.
    const { data, error } = await context.supabase.rpc("get_my_profile");
    if (error) throw new Error(error.message);
    return data ?? null;
  });


export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      display_name?: string;
      avatar_url?: string | null;
      bio?: string | null;
      preferred_genres?: string[];
      preferred_types?: string[];
      favorite_styles?: string[];
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
