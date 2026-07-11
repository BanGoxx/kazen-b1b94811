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
        "media_key,status,favorite,priority,rating,notes,tags,updated_at,media_records(*)",
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
    const { error: mediaError } = await context.supabase.rpc(
      "upsert_media_record_snapshot",
      {
        p_media_key: m.key,
        p_source: m.source,
        p_external_id: m.externalId,
        p_media_type: m.mediaType,
        p_title: m.title,
        p_title_original: m.titleOriginal,
        p_poster_url: m.posterUrl,
        p_backdrop_url: m.backdropUrl,
        p_release_date: m.releaseDate,
        p_genres: m.genres,
        p_platforms: m.platforms as never,
        p_score: m.score,
      },
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
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
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
