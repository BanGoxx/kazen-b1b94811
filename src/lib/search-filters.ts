import type { MediaItem } from "./media-types";
import { relevanceScore } from "./search-rank";

// Client-side filtering + sorting for the search results page. Operates on the
// already-fetched (and React-Query-cached) result groups, so it adds no extra
// API calls and preserves AniList/TMDB protections.

export type SortKey = "pertinence" | "popularite" | "note" | "date";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "pertinence", label: "Pertinence" },
  { key: "popularite", label: "Popularité" },
  { key: "note", label: "Note" },
  { key: "date", label: "Date de sortie" },
];

export const MIN_SCORE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Toutes notes" },
  { value: 6, label: "6+" },
  { value: 7, label: "7+" },
  { value: 8, label: "8+" },
  { value: 9, label: "9+" },
];

// Preferred ordering for genre chips — the genres the product cares about most
// surface first; anything else follows alphabetically.
const GENRE_PRIORITY = [
  "Action",
  "Aventure",
  "Shonen",
  "Horreur",
  "Comédie",
  "Drame",
  "Fantastique",
  "Science-Fiction",
  "Romance",
  "Thriller",
  "Mystère",
  "Surnaturel",
  "Psychologique",
  "Tranche de vie",
  "Sport",
  "Mecha",
  "Animation",
];

export interface SearchFilters {
  genres: string[];
  minScore: number;
  sort: SortKey;
}

/** Union of genres present across the current results, ordered by priority. */
export function availableGenres(...groups: (MediaItem[] | undefined)[]): string[] {
  const set = new Set<string>();
  for (const g of groups) for (const item of g ?? []) for (const genre of item.genres) set.add(genre);
  const all = [...set];
  all.sort((a, b) => {
    const ia = GENRE_PRIORITY.indexOf(a);
    const ib = GENRE_PRIORITY.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    return a.localeCompare(b, "fr");
  });
  return all;
}

function releaseTime(item: MediaItem): number {
  if (!item.releaseDate) return -Infinity;
  const t = Date.parse(item.releaseDate);
  return Number.isNaN(t) ? -Infinity : t;
}

/**
 * Filter a single result group by genre + minimum score, then sort.
 * Original source order is preserved as the popularity proxy (search endpoints
 * already return the most popular/relevant first).
 */
export function filterAndSort(items: MediaItem[], filters: SearchFilters, query: string): MediaItem[] {
  const min100 = filters.minScore * 10;
  const filtered = items.filter((item) => {
    if (filters.minScore > 0 && (item.score == null || item.score < min100)) return false;
    if (filters.genres.length && !filters.genres.every((g) => item.genres.includes(g))) return false;
    return true;
  });

  const indexed = filtered.map((item, i) => ({ item, i }));

  indexed.sort((a, b) => {
    switch (filters.sort) {
      case "note": {
        const sa = a.item.score ?? -1;
        const sb = b.item.score ?? -1;
        return sb - sa || a.i - b.i;
      }
      case "date":
        return releaseTime(b.item) - releaseTime(a.item) || a.i - b.i;
      case "popularite":
        return a.i - b.i; // source order = popularity proxy
      case "pertinence":
      default: {
        const ra = relevanceScore(query, a.item);
        const rb = relevanceScore(query, b.item);
        return rb - ra || a.i - b.i;
      }
    }
  });

  return indexed.map((x) => x.item);
}
