import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
  getTrendingAnime,
  getPopularAnime,
  getUpcomingAnime,
  getSeasonalAnime,
  getTrendingMovies,
  getPopularMovies,
  getUpcomingMovies,
  getTrendingSeries,
  getPopularSeries,
  getOnAirSeries,
  getMediaDetail,
  searchMedia,
  getUpcomingAll,
  getAnimatedMovies,
  getAsianAnimationMovies,
} from "./discover.functions";
import { getEntityProfile } from "./entity.functions";
import {
  anilistPublicPage,
  anilistPublicSearchPaged,
  anilistPublicList,
  anilistPublicSeasonal,
} from "./anilist-public";

const HOUR = 1000 * 60 * 60;
const IS_BROWSER = typeof window !== "undefined";

// Homepage anime rails: on the server, use the cached server handlers (which
// fall back to a curated list when the Worker is 403-blocked by AniList). On
// the client, prefer the browser-direct AniList CORS path so production shows
// the real, complete lists even when the Worker stays blocked — then fall back
// to the SSR value on any client error. staleTime 0 on the client lets the
// browser immediately replace any curated SSR fallback with real data.
async function isoAnimeList(
  kind: "trending" | "popular" | "upcoming",
  serverFn: () => Promise<import("./media-types").MediaItem[]>,
) {
  if (IS_BROWSER) {
    try {
      const items = await anilistPublicList(kind);
      if (items.length) return items;
    } catch (error) {
      console.error("anilistPublicList", kind, error);
    }
  }
  return serverFn();
}

export const trendingAnimeQO = queryOptions({
  queryKey: ["anime", "trending"],
  queryFn: () => isoAnimeList("trending", getTrendingAnime),
  // Keep the dehydrated server data authoritative for the first client render
  // (staleTime HOUR, no forced refetchOnMount) so SSR and hydration match. The
  // browser-direct upgrade is triggered deliberately AFTER hydration via
  // refreshAnimeRails(), which avoids the mid-hydration data swap that crashed.
  staleTime: HOUR,
  retry: 3,
});
export const popularAnimeQO = queryOptions({
  queryKey: ["anime", "popular"],
  queryFn: () => isoAnimeList("popular", getPopularAnime),
  staleTime: HOUR,
  retry: 3,
});
export const upcomingAnimeQO = queryOptions({
  queryKey: ["anime", "upcoming"],
  queryFn: () => isoAnimeList("upcoming", getUpcomingAnime),
  staleTime: HOUR,
  retry: 3,
});

export const seasonalAnimeQO = (season?: string, year?: number) =>
  queryOptions({
    queryKey: ["anime", "seasonal", season ?? "current", year ?? "current"],
    queryFn: async () => {
      if (IS_BROWSER) {
        try {
          const result = await anilistPublicSeasonal(season, year);
          if (result.items.length) return result;
        } catch (error) {
          console.error("anilistPublicSeasonal", error);
        }
      }
      return getSeasonalAnime({ data: { season, year } });
    },
    staleTime: HOUR,
    retry: 3,
  });

/**
 * Post-hydration browser-direct upgrade for the AniList home rails.
 *
 * The rail queries render from dehydrated server data on the first client paint
 * (so SSR and hydration match and React does not crash). Once the app has
 * hydrated, call this to pull the complete browser-direct AniList lists — this
 * matters in production, where the Worker is often AniList-blocked and the SSR
 * data is a curated fallback. Runs only in the browser and only when needed.
 */
export function refreshAnimeRails(queryClient: import("@tanstack/react-query").QueryClient) {
  if (typeof window === "undefined") return;
  void queryClient.refetchQueries({ queryKey: ["anime"], type: "active" });
}

// One-time, post-hydration browser-direct upgrade for a catalog query.
//
// Anime/seasonal/upcoming catalogs render from dehydrated SSR data on the first
// client paint (which may be the curated fallback when the production Worker is
// AniList-blocked). We must upgrade that to the real browser-direct list — but
// only ONCE per query per session. Doing it on every mount (the old
// `staleTime:0 + refetchOnMount:true`) refetched every loaded page on every
// back-navigation/tab-switch, which lost scroll position, dropped loaded pages
// and hammered AniList. This upgrades exactly once, then the HOUR staleTime lets
// back-navigation reuse the in-memory cache instantly.
const upgradedCatalogKeys = new Set<string>();
export function upgradeCatalogOnce(
  queryClient: import("@tanstack/react-query").QueryClient,
  queryKey: readonly unknown[],
) {
  if (!IS_BROWSER) return;
  const k = JSON.stringify(queryKey);
  if (upgradedCatalogKeys.has(k)) return;
  upgradedCatalogKeys.add(k);
  void queryClient.refetchQueries({ queryKey, exact: true, type: "active" });
}



export const trendingMoviesQO = queryOptions({
  queryKey: ["movies", "trending"],
  queryFn: () => getTrendingMovies(),
  staleTime: HOUR,
});
export const popularMoviesQO = queryOptions({
  queryKey: ["movies", "popular"],
  queryFn: () => getPopularMovies(),
  staleTime: HOUR,
});
export const upcomingMoviesQO = queryOptions({
  queryKey: ["movies", "upcoming"],
  queryFn: () => getUpcomingMovies(),
  staleTime: HOUR,
});
export const animatedMoviesQO = queryOptions({
  queryKey: ["movies", "animated"],
  queryFn: () => getAnimatedMovies(),
  staleTime: HOUR,
});
export const asianAnimationMoviesQO = queryOptions({
  queryKey: ["movies", "asian-animation"],
  queryFn: () => getAsianAnimationMovies(),
  staleTime: HOUR,
});



export const trendingSeriesQO = queryOptions({
  queryKey: ["series", "trending"],
  queryFn: () => getTrendingSeries(),
  staleTime: HOUR,
});
export const popularSeriesQO = queryOptions({
  queryKey: ["series", "popular"],
  queryFn: () => getPopularSeries(),
  staleTime: HOUR,
});
export const onAirSeriesQO = queryOptions({
  queryKey: ["series", "onair"],
  queryFn: () => getOnAirSeries(),
  staleTime: HOUR,
});

export const upcomingAllQO = queryOptions({
  queryKey: ["upcoming", "all"],
  // Isomorphic: the server function provides upcoming films/series (TMDB) and a
  // curated anime fallback. On the client we additionally pull real upcoming
  // anime browser-direct (Worker can be AniList-blocked) so the Anime tab is
  // never thin. Merge + de-dupe by key, keeping the richest anime set.
  queryFn: async () => {
    const server = await getUpcomingAll();
    if (!IS_BROWSER) return server;
    try {
      // Pull several pages of real upcoming anime so the Anime tab has depth
      // (the Worker's curated fallback is only a handful). Sequential + bounded
      // to respect AniList rate limits; stop as soon as a page runs dry.
      const anime: import("./media-types").MediaItem[] = [];
      for (let page = 1; page <= 3; page++) {
        const res = await anilistPublicPage("upcoming", page);
        anime.push(...res.items);
        if (!res.hasMore) break;
      }
      if (!anime.length) return server;
      const seen = new Set(anime.map((a) => a.key));
      // Drop the server's curated anime placeholders in favor of the real list,
      // keep every film/series the server returned.
      const nonAnime = server.filter((it) => it.mediaType !== "anime" && !seen.has(it.key));
      return [...anime, ...nonAnime];
    } catch (error) {
      console.error("upcomingAll anime merge", error);
      return server;
    }
  },

  // Reuse the in-memory cache on back-navigation (HOUR fresh); the real
  // browser-direct anime merge is applied once post-hydration via
  // upgradeCatalogOnce(["upcoming","all"]) instead of on every mount.
  staleTime: HOUR,
  retry: 3,
});


export const mediaDetailQO = (source: string, id: string) =>
  queryOptions({
    queryKey: ["media", source, id],
    queryFn: () => getMediaDetail({ data: { source, id } }),
    staleTime: HOUR,
    retry: 2,
  });

export const searchMediaQO = (q: string) =>
  queryOptions({
    queryKey: ["search", q],
    queryFn: () => searchMedia({ data: { q } }),
    staleTime: 1000 * 60 * 5,
    enabled: q.trim().length >= 2,
  });

export const entityProfileQO = (kind: string, id: string) =>
  queryOptions({
    queryKey: ["entity", kind, id],
    queryFn: () => getEntityProfile({ data: { kind, id } }),
    staleTime: HOUR,
    retry: 2,
  });

import { getAnimePage, getMoviePage, getSeriesPage, searchMediaPaged, getSeasonalAnimePage } from "./discover.functions";
import { anilistPublicSeasonalPage } from "./anilist-public";
import type { PagedMedia } from "./tmdb.server";

interface SearchPage {
  anime: import("./media-types").MediaItem[];
  series: import("./media-types").MediaItem[];
  movies: import("./media-types").MediaItem[];
  page: number;
  hasMore: boolean;
}

export const searchMediaInfiniteQO = (q: string) =>
  infiniteQueryOptions({
    queryKey: ["search", "infinite", q],
    queryFn: async ({ pageParam }) => {
      const page = Number(pageParam) || 1;
      if (typeof window === "undefined") return searchMediaPaged({ data: { q, page } });

      const [baseResult, animeResult] = await Promise.allSettled([
        searchMediaPaged({ data: { q, page } }),
        q.trim().length >= 2 ? anilistPublicSearchPaged(q, page) : Promise.resolve({ items: [], hasMore: false }),
      ]);
      const base: SearchPage =
        baseResult.status === "fulfilled"
          ? baseResult.value
          : { anime: [], series: [], movies: [], page, hasMore: false };
      if (animeResult.status !== "fulfilled") return base;
      return {
        ...base,
        anime: animeResult.value.items.length ? animeResult.value.items : base.anime,
        hasMore: base.hasMore || animeResult.value.hasMore,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (last: SearchPage) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 1000 * 60 * 5,
    enabled: q.trim().length >= 2,
  });


const pagedInitial = { pageParams: [1] as number[], pages: [] as PagedMedia[] };
void pagedInitial;

export const animePageQO = (kind: string) =>
  infiniteQueryOptions({
    queryKey: ["anime", "page", kind],
    queryFn: async ({ pageParam }) => {
      const page = Number(pageParam) || 1;
      if (typeof window !== "undefined") {
        try {
          return await anilistPublicPage(kind, page);
        } catch (error) {
          console.error("anilistPublicPage", error);
        }
      }
      return getAnimePage({ data: { kind, page } });
    },
    initialPageParam: 1,
    getNextPageParam: (last: PagedMedia) => (last.hasMore ? last.page + 1 : undefined),
    // Server SSR may only have the curated fallback when the production Worker
    // is blocked by AniList. On the client, mark it stale so the browser CORS
    // path immediately replaces page 1 with real AniList data, then page 2+
    // keeps progressive loading alive.
    staleTime: typeof window === "undefined" ? HOUR : 0,
    refetchOnMount: true,
    retry: 3,
  });

export const moviePageQO = (kind: string) =>
  infiniteQueryOptions({
    queryKey: ["movies", "page", kind],
    queryFn: ({ pageParam }) => getMoviePage({ data: { kind, page: pageParam } }),
    initialPageParam: 1,
    getNextPageParam: (last: PagedMedia) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: HOUR,
  });

export const seriesPageQO = (kind: string) =>
  infiniteQueryOptions({
    queryKey: ["series", "page", kind],
    queryFn: ({ pageParam }) => getSeriesPage({ data: { kind, page: pageParam } }),
    initialPageParam: 1,
    getNextPageParam: (last: PagedMedia) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: HOUR,
  });

export const seasonalAnimePageQO = (season?: string, year?: number) =>
  infiniteQueryOptions({
    queryKey: ["anime", "seasonal", "page", season ?? "current", year ?? "current"],
    queryFn: async ({ pageParam }) => {
      const page = Number(pageParam) || 1;
      if (typeof window !== "undefined") {
        try {
          const res = await anilistPublicSeasonalPage(season, year, page);
          if (res.items.length || page > 1) return res;
        } catch (error) {
          console.error("anilistPublicSeasonalPage", error);
        }
      }
      return getSeasonalAnimePage({ data: { season, year, page } });
    },
    initialPageParam: 1,
    getNextPageParam: (last: PagedMedia) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: typeof window === "undefined" ? HOUR : 0,
    refetchOnMount: true,
    retry: 3,
  });
