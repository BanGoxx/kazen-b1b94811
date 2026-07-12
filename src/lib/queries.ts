import { queryOptions } from "@tanstack/react-query";
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

const HOUR = 1000 * 60 * 60;

export const trendingAnimeQO = queryOptions({
  queryKey: ["anime", "trending"],
  queryFn: () => getTrendingAnime(),
  staleTime: HOUR,
  retry: 3,
});
export const popularAnimeQO = queryOptions({
  queryKey: ["anime", "popular"],
  queryFn: () => getPopularAnime(),
  staleTime: HOUR,
  retry: 3,
});
export const upcomingAnimeQO = queryOptions({
  queryKey: ["anime", "upcoming"],
  queryFn: () => getUpcomingAnime(),
  staleTime: HOUR,
  retry: 3,
});
export const seasonalAnimeQO = (season?: string, year?: number) =>
  queryOptions({
    queryKey: ["anime", "seasonal", season ?? "current", year ?? "current"],
    queryFn: () => getSeasonalAnime({ data: { season, year } }),
    staleTime: HOUR,
    retry: 3,
  });

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
  queryFn: () => getUpcomingAll(),
  staleTime: HOUR,
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

import { infiniteQueryOptions } from "@tanstack/react-query";
import { getAnimePage, getMoviePage, getSeriesPage, searchMediaPaged } from "./discover.functions";
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
    queryFn: ({ pageParam }) => searchMediaPaged({ data: { q, page: pageParam } }),
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
    queryFn: ({ pageParam }) => getAnimePage({ data: { kind, page: pageParam } }),
    initialPageParam: 1,
    getNextPageParam: (last: PagedMedia) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: HOUR,
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
