import type { MediaItem, MediaStatus } from "./media-types";

// Client-side derivation & filtering utilities for the catalogue pages.
// External data stays untouched; these helpers just shape it for browsing.

export type SortKey = "trending" | "score" | "recent" | "alpha";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "trending", label: "Pertinence" },
  { value: "score", label: "Mieux notés" },
  { value: "recent", label: "Plus récents" },
  { value: "alpha", label: "A → Z" },
];

/** Unique genres across a list, sorted by frequency then alphabetically. */
export function collectGenres(items: MediaItem[], limit = 14): string[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    for (const g of it.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .slice(0, limit)
    .map(([g]) => g);
}

function releaseTime(item: MediaItem): number {
  return item.releaseDate ? new Date(item.releaseDate).getTime() : 0;
}

export function sortItems(items: MediaItem[], key: SortKey): MediaItem[] {
  const arr = [...items];
  switch (key) {
    case "score":
      return arr.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    case "recent":
      return arr.sort((a, b) => releaseTime(b) - releaseTime(a));
    case "alpha":
      return arr.sort((a, b) => a.title.localeCompare(b.title, "fr"));
    default:
      return arr;
  }
}

export function filterItems(
  items: MediaItem[],
  opts: { genres: string[]; status: MediaStatus | "all" },
): MediaItem[] {
  return items.filter((it) => {
    if (opts.status !== "all" && it.status !== opts.status) return false;
    if (opts.genres.length && !opts.genres.every((g) => it.genres.includes(g))) return false;
    return true;
  });
}
