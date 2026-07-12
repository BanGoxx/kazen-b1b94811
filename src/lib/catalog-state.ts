import type { FilterState } from "@/components/media/FilterBar";

/**
 * Session-scoped catalog UI state (filters/sort) persistence.
 *
 * Purpose: when a user filters/sorts a catalog, opens a fiche, then presses the
 * browser Back button, the catalog component remounts with fresh local state and
 * would otherwise reset to defaults — changing the visible list and defeating
 * the router's scroll restoration. Persisting the lightweight filter selection
 * in sessionStorage lets the catalog restore the exact view on back-navigation.
 *
 * Safety:
 *  - Only non-sensitive, public UI state (chosen genres/status/sort) is stored.
 *  - sessionStorage (not localStorage): scoped to the tab, cleared on close.
 *  - Versioned key + try/catch so a bad/legacy blob can never crash a render.
 *  - Read is done post-hydration (useEffect), never in a useState initializer,
 *    so it can never cause an SSR/client hydration mismatch.
 */

const VERSION = "v1";
const PREFIX = `kazen:catalog-filters:${VERSION}:`;

const VALID_STATUS = new Set(["all", "airing", "upcoming", "finished"]);

export function readCatalogFilters(key: string): FilterState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FilterState>;
    if (!parsed || typeof parsed !== "object") return null;
    const genres = Array.isArray(parsed.genres)
      ? parsed.genres.filter((g): g is string => typeof g === "string")
      : [];
    const status =
      typeof parsed.status === "string" && VALID_STATUS.has(parsed.status)
        ? (parsed.status as FilterState["status"])
        : "all";
    const sort = typeof parsed.sort === "string" ? (parsed.sort as FilterState["sort"]) : "trending";
    return { genres, status, sort };
  } catch {
    return null;
  }
}

export function writeCatalogFilters(key: string, state: FilterState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(state));
  } catch {
    /* storage full / disabled — non-fatal, filters just won't persist */
  }
}
