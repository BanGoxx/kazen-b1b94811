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
  episodesCount: number | null;
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
    episodesCount: item.episodesCount,
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

// Server-authoritative allow-list of watch statuses. Anything else is dropped.
const ALLOWED_STATUSES = new Set([
  "a_voir",
  "en_cours",
  "termine",
  "en_pause",
  "abandonne",
]);
const ALLOWED_PRIORITIES = new Set(["basse", "normale", "haute"]);

// A yyyy-mm-dd or ISO date string, else null. Rejects malformed input so a
// direct API call can't write garbage into the date columns.
function safeDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : value;
}

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
        episodes_count:
          m.episodesCount != null && m.episodesCount > 0
            ? Math.floor(m.episodesCount)
            : null,
      },
      { onConflict: "media_key" },
    );
    if (mediaError) throw new Error(mediaError.message);

    // Server-side reliable maximum: movies are binary (0/1); episodic titles use
    // the stored provider total. The client-sent max is never trusted — we read
    // the total we just persisted from a provider snapshot.
    const { data: rec } = await context.supabase
      .from("media_records")
      .select("media_type,episodes_count")
      .eq("media_key", m.key)
      .maybeSingle();
    const serverMax =
      rec?.media_type === "movie"
        ? 1
        : rec?.episodes_count != null && rec.episodes_count > 0
          ? rec.episodes_count
          : null;

    // Sanitize the patch server-side: integer non-negative progress capped to
    // the reliable maximum, valid enums, and valid dates. Guarantees hold even
    // for a direct API call that bypasses the UI.
    const raw = data.patch;
    const clean: ListPatch = { ...raw };

    if ("progress" in raw) {
      if (raw.progress == null) {
        clean.progress = null;
      } else {
        let p = Math.max(0, Math.floor(Number(raw.progress) || 0));
        if (serverMax != null) p = Math.min(p, serverMax);
        clean.progress = p;
      }
    }
    if ("status" in raw) {
      clean.status =
        raw.status && ALLOWED_STATUSES.has(raw.status) ? raw.status : null;
    }
    if ("priority" in raw && raw.priority && !ALLOWED_PRIORITIES.has(raw.priority)) {
      delete clean.priority;
    }
    if ("rating" in raw) {
      clean.rating =
        raw.rating == null
          ? null
          : Math.min(10, Math.max(1, Math.floor(Number(raw.rating) || 0)));
    }
    if ("rewatch_count" in raw) {
      clean.rewatch_count = Math.max(0, Math.floor(Number(raw.rewatch_count) || 0));
    }
    const sd = safeDate(raw.started_at);
    if (sd !== undefined) clean.started_at = sd;
    const cd = safeDate(raw.completed_at);
    if (cd !== undefined) clean.completed_at = cd;

    const { error } = await context.supabase.from("list_items").upsert(
      {
        user_id: context.userId,
        media_key: m.key,
        ...clean,
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
