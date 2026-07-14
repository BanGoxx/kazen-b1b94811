// Trusted, server-only catalogue metadata writer.
//
// `media_records.episodes_count` is the authoritative progress cap used by the
// tracking validator. It must NEVER originate from a client-supplied snapshot.
// The `authenticated` role has its column privilege revoked, so only the
// service-role admin client (used here) can write it.
//
// This runs from trusted server paths that ALREADY hold provider metadata
// (e.g. `getMediaDetail`, which fetched the provider detail server-side). It
// performs NO additional provider call: it only persists a count that was
// already fetched. It is bounded — a no-op unless we have a reliable count and
// the stored value actually differs — so it never turns into an N+1 or a retry
// loop on ordinary reads.
//
// This file is `*.server.ts`: it is filename-blocked from client bundles, so a
// client-reachable module may only reach it via `await import(...)` inside a
// server handler.

const ALLOWED_SOURCES = new Set(["anilist", "tmdb_movie", "tmdb_tv"]);
const ALLOWED_TYPES = new Set(["anime", "movie", "series"]);

export async function syncCatalogueEpisodes(input: {
  mediaKey: string;
  source: string;
  mediaType: string;
  episodesCount: number | null | undefined;
}): Promise<void> {
  const { mediaKey, source, mediaType, episodesCount } = input;

  // Only episodic titles carry a meaningful trusted total. Movies are handled
  // as a binary 0/1 by the tracking validator and never need a stored count.
  if (mediaType === "movie") return;
  if (!ALLOWED_SOURCES.has(source) || !ALLOWED_TYPES.has(mediaType)) return;
  if (!mediaKey || mediaKey.length < 3 || mediaKey.length > 128) return;

  const count =
    episodesCount != null && Number.isFinite(episodesCount) && episodesCount > 0
      ? Math.floor(episodesCount)
      : null;
  // Never overwrite a known trusted total with an "unknown" (null) value.
  if (count == null) return;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Bounded write: only touch an EXISTING catalogue row, and only when the
    // trusted total actually changes. We never create rows for merely-viewed
    // titles (that stays the job of list/playlist tracking), and we never
    // re-run a provider call — this uses the count already fetched by the
    // caller. The row for a tracked title is created by the list mutation, so
    // its trusted total is applied on the next server fiche load.
    const { data: existing } = await supabaseAdmin
      .from("media_records")
      .select("media_key,episodes_count")
      .eq("media_key", mediaKey)
      .maybeSingle();

    if (!existing) return;
    if (existing.episodes_count === count) return;

    await supabaseAdmin
      .from("media_records")
      .update({ episodes_count: count })
      .eq("media_key", mediaKey);
  } catch (e) {
    // Trusted enrichment is best-effort: a failure here must never break the
    // fiche or a tracking flow. Progress simply keeps the safe "unknown total".
    console.error("syncCatalogueEpisodes", e);
  }
}
