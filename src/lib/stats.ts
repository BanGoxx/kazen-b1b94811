// KAZEN — Personal viewing statistics (Phase 19).
//
// PURE, deterministic computation of a member's personal statistics from their
// own "Ma liste" tracking data. No network, no React, no DB — only value
// transforms, which keeps every formula testable and impossible to drift.
//
// PRIVACY: this module never fetches or exposes another member's data. It only
// transforms rows that the caller already authorized (see stats.functions.ts,
// which reads the current member's own list under RLS).
//
// ESTIMATION POLICY (important):
// - The catalogue stores episode counts (`episodes_count`) but NOT per-episode
//   or per-movie runtime. There is therefore NO trusted runtime source.
// - Episode/movie COUNTS are treated as EXACT.
// - Viewing TIME is always an ESTIMATION built from the standard per-type
//   durations below and is flagged `viewingIsEstimated: true`. Entries whose
//   episode count / progress is unknown are EXCLUDED from the total and counted
//   in `viewingExcludedUnknown` — we never invent an episode count or runtime.

import type { MediaType, WatchStatus } from "./media-types";

/** Standard per-type runtime ESTIMATES (minutes). Not sourced from data. */
export const RUNTIME_ESTIMATE_MIN: Record<MediaType, number> = {
  anime: 24, // per episode
  series: 45, // per episode
  movie: 110, // per film
};

/** Raw list row shape needed for stats (subset of list_items + media_records). */
export interface StatsRow {
  status: WatchStatus | null;
  favorite: boolean;
  rating: number | null; // 1..10 or null
  progress: number | null; // watched episodes or null
  started_at: string | null; // date (YYYY-MM-DD) or null
  completed_at: string | null; // date (YYYY-MM-DD) or null
  rewatch_count: number;
  created_at: string; // timestamptz ISO
  media: {
    media_type: MediaType;
    genres: string[];
    episodes_count: number | null;
    title: string;
    poster_url: string | null;
  } | null;
}

export interface TopTitle {
  title: string;
  posterUrl: string | null;
  value: number;
}

export interface MonthlyPoint {
  month: string; // YYYY-MM
  label: string; // "janv. 25"
  completed: number;
  added: number;
}

export interface PersonalStats {
  total: number;
  byStatus: Record<WatchStatus, number>;
  favorites: number;
  avgRating: number | null;
  ratedCount: number;
  byType: Record<MediaType, number>;
  genres: { name: string; count: number }[];
  ratingHistogram: { rating: number; count: number }[]; // 1..10
  monthly: MonthlyPoint[]; // last 12 months (Europe/Paris)
  viewingMinutes: number;
  viewingIsEstimated: boolean;
  viewingExcludedUnknown: number;
  completionRate: number; // 0..1
  discoveriesThisYear: number;
  avgDaysToFinish: number | null;
  topFavorites: TopTitle[];
  topRewatched: TopTitle[];
  topRated: TopTitle[];
}

const ALL_STATUSES: WatchStatus[] = [
  "a_voir",
  "en_cours",
  "termine",
  "en_pause",
  "abandonne",
];
const ALL_TYPES: MediaType[] = ["anime", "series", "movie"];

/** Europe/Paris "YYYY-MM" for a timestamptz ISO string. */
function parisMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // fr-CA renders as YYYY-MM-DD, which we slice to YYYY-MM.
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .slice(0, 7);
}

/** Europe/Paris current year (for "discoveries this year"). */
function parisYear(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
    }).format(now),
  );
}

/** Month label like "janv. 25" from a YYYY-MM key. */
function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m ?? 1) - 1, 1));
  return d
    .toLocaleDateString("fr-FR", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    })
    .replace(".", "");
}

/** Whole days between two YYYY-MM-DD dates (>= 0), or null if invalid. */
function daysBetween(start: string, end: string): number | null {
  const s = new Date(`${start.slice(0, 10)}T00:00:00Z`).getTime();
  const e = new Date(`${end.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  return Math.round((e - s) / 86_400_000);
}

/**
 * Compute the full personal statistics DTO from a member's own list rows.
 *
 * Formulas (documented):
 * - total: number of tracked (non-deleted) entries. Deleted entries never reach
 *   here because they are removed from list_items.
 * - byStatus[s]: count of entries whose status === s. Null status is ignored.
 * - favorites: count where favorite === true.
 * - avgRating: mean of ratings in [1,10], excluding null; null if none (no /0).
 * - byType[t]: count where media.media_type === t.
 * - genres: descending count of genre occurrences across all entries (top 12).
 * - ratingHistogram: count of entries per integer rating 1..10.
 * - monthly: last 12 Europe/Paris months. `completed` groups by completed_at,
 *   `added` groups by created_at (Paris).
 * - viewingMinutes (ESTIMATED): sum over entries of episodesWatched * runtime,
 *   multiplied by (1 + rewatch_count). episodesWatched:
 *     movie  -> 1 when status === "termine", else 0
 *     anime/series -> progress ?? (status "termine" ? episodes_count : 0)
 *   Entries with unknown count (needed but null) are excluded and counted in
 *   viewingExcludedUnknown. Runtimes are standard estimates, so the flag is set.
 * - completionRate: byStatus.termine / total (0 when total is 0).
 * - discoveriesThisYear: entries created in the current Paris year.
 * - avgDaysToFinish: mean days between started_at and completed_at for entries
 *   with both valid dates; null when none.
 * - topFavorites/topRewatched/topRated: bounded top-5 lists.
 */
export function computeStats(rows: StatsRow[], now: Date = new Date()): PersonalStats {
  const byStatus = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, 0]),
  ) as Record<WatchStatus, number>;
  const byType = Object.fromEntries(ALL_TYPES.map((t) => [t, 0])) as Record<
    MediaType,
    number
  >;
  const genreCounts = new Map<string, number>();
  const ratingHist = new Map<number, number>();

  let favorites = 0;
  let ratingSum = 0;
  let ratedCount = 0;
  let viewingMinutes = 0;
  let viewingExcludedUnknown = 0;
  let discoveriesThisYear = 0;
  let daysSum = 0;
  let daysCount = 0;

  const thisYear = parisYear(now);

  // Build the last-12-month skeleton in Paris time.
  const monthKeys: string[] = [];
  {
    const nowParis = parisMonth(now.toISOString());
    let [y, m] = nowParis.split("-").map(Number);
    for (let i = 0; i < 12; i++) {
      monthKeys.unshift(`${y}-${String(m).padStart(2, "0")}`);
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }
  }
  const completedByMonth = new Map<string, number>(monthKeys.map((k) => [k, 0]));
  const addedByMonth = new Map<string, number>(monthKeys.map((k) => [k, 0]));

  for (const r of rows) {
    if (r.status && r.status in byStatus) byStatus[r.status] += 1;
    if (r.favorite) favorites += 1;

    if (r.rating != null && r.rating >= 1 && r.rating <= 10) {
      ratingSum += r.rating;
      ratedCount += 1;
      ratingHist.set(r.rating, (ratingHist.get(r.rating) ?? 0) + 1);
    }

    const media = r.media;
    if (media) {
      byType[media.media_type] = (byType[media.media_type] ?? 0) + 1;
      for (const g of media.genres ?? []) {
        const name = g.trim();
        if (name) genreCounts.set(name, (genreCounts.get(name) ?? 0) + 1);
      }
    }

    // Discoveries this year (Paris).
    if (parisMonth(r.created_at).startsWith(String(thisYear))) {
      discoveriesThisYear += 1;
    }

    // Monthly additions (created_at, Paris).
    const addM = parisMonth(r.created_at);
    if (addedByMonth.has(addM)) addedByMonth.set(addM, addedByMonth.get(addM)! + 1);

    // Monthly completions (completed_at, date column — no tz shift).
    if (r.completed_at) {
      const cM = r.completed_at.slice(0, 7);
      if (completedByMonth.has(cM))
        completedByMonth.set(cM, completedByMonth.get(cM)! + 1);
    }

    // Average time between start and finish.
    if (r.started_at && r.completed_at) {
      const d = daysBetween(r.started_at, r.completed_at);
      if (d != null) {
        daysSum += d;
        daysCount += 1;
      }
    }

    // Estimated viewing time.
    if (media) {
      const rewatchMult = 1 + Math.max(0, r.rewatch_count | 0);
      if (media.media_type === "movie") {
        if (r.status === "termine") {
          viewingMinutes += RUNTIME_ESTIMATE_MIN.movie * rewatchMult;
        }
      } else {
        let episodes: number | null;
        if (r.progress != null && r.progress >= 0) {
          episodes = r.progress;
        } else if (r.status === "termine") {
          episodes =
            media.episodes_count != null && media.episodes_count > 0
              ? media.episodes_count
              : null; // completed but unknown length → excluded
        } else {
          episodes = 0; // not started/known progress → 0, not unknown
        }
        if (episodes == null) {
          viewingExcludedUnknown += 1;
        } else if (episodes > 0) {
          viewingMinutes +=
            episodes * RUNTIME_ESTIMATE_MIN[media.media_type] * rewatchMult;
        }
      }
    }
  }

  const total = rows.length;

  const genres = [...genreCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 12);

  const ratingHistogram = Array.from({ length: 10 }, (_, i) => ({
    rating: i + 1,
    count: ratingHist.get(i + 1) ?? 0,
  }));

  const monthly: MonthlyPoint[] = monthKeys.map((month) => ({
    month,
    label: monthLabel(month),
    completed: completedByMonth.get(month) ?? 0,
    added: addedByMonth.get(month) ?? 0,
  }));

  const topFavorites = rows
    .filter((r) => r.favorite && r.media)
    .map((r) => ({
      title: r.media!.title,
      posterUrl: r.media!.poster_url,
      value: r.rating ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const topRewatched = rows
    .filter((r) => r.rewatch_count > 0 && r.media)
    .map((r) => ({
      title: r.media!.title,
      posterUrl: r.media!.poster_url,
      value: r.rewatch_count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const topRated = rows
    .filter((r) => r.rating != null && r.media)
    .map((r) => ({
      title: r.media!.title,
      posterUrl: r.media!.poster_url,
      value: r.rating as number,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    total,
    byStatus,
    favorites,
    avgRating: ratedCount > 0 ? ratingSum / ratedCount : null,
    ratedCount,
    byType,
    genres,
    ratingHistogram,
    monthly,
    viewingMinutes,
    viewingIsEstimated: true,
    viewingExcludedUnknown,
    completionRate: total > 0 ? byStatus.termine / total : 0,
    discoveriesThisYear,
    avgDaysToFinish: daysCount > 0 ? daysSum / daysCount : null,
    topFavorites,
    topRewatched,
    topRated,
  };
}

/** Human-friendly "Xh Ymin" (or "Nj Xh") from a minute total. */
export function formatViewingTime(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const totalHours = Math.floor(minutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const mins = Math.round(minutes % 60);
  if (days > 0) return `${days} j ${hours} h`;
  if (totalHours > 0) return `${totalHours} h ${mins} min`;
  return `${mins} min`;
}
