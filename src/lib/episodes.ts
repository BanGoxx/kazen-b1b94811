import type { MediaEpisode } from "./media-types";

/**
 * Episode ordering & normalization helpers (Step D).
 *
 * Ordering rule (coherent even with partial metadata):
 *  1. by episode number ascending (the canonical viewing order),
 *  2. tie-break by air date ascending when numbers collide/are missing,
 *  3. stable otherwise.
 * We never fabricate numbers, titles, or dates — missing parts stay null and
 * are hidden gracefully by the UI.
 */
export function orderEpisodes(episodes: MediaEpisode[]): MediaEpisode[] {
  return [...episodes].sort((a, b) => {
    const na = Number.isFinite(a.number) ? a.number : Number.POSITIVE_INFINITY;
    const nb = Number.isFinite(b.number) ? b.number : Number.POSITIVE_INFINITY;
    if (na !== nb) return na - nb;
    const ta = a.airDate ? new Date(a.airDate).getTime() : Number.POSITIVE_INFINITY;
    const tb = b.airDate ? new Date(b.airDate).getTime() : Number.POSITIVE_INFINITY;
    return ta - tb;
  });
}

/** Mark whether each episode has already aired, based on its air date. */
export function withAiredFlag(episodes: MediaEpisode[]): MediaEpisode[] {
  const now = Date.now();
  return episodes.map((e) => ({
    ...e,
    isAired: e.airDate
      ? new Date(e.airDate).getTime() <= now
      : e.isAired,
  }));
}

/**
 * Parse an AniList streamingEpisodes title like "Episode 12 - The Title" into
 * a number + clean title. Returns null number when it can't be parsed safely.
 */
export function parseStreamingTitle(raw: string | null | undefined): {
  number: number | null;
  title: string | null;
} {
  if (!raw) return { number: null, title: null };
  const m = raw.match(/(?:episode|ep\.?|épisode)\s*(\d+)\s*[-–:]?\s*(.*)$/i);
  if (m) {
    const number = Number(m[1]);
    const title = m[2]?.trim() || null;
    return { number: Number.isFinite(number) ? number : null, title };
  }
  return { number: null, title: raw.trim() || null };
}
