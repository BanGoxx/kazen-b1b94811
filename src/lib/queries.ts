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
} from "./discover.functions";

const HOUR = 1000 * 60 * 60;

export const trendingAnimeQO = queryOptions({
  queryKey: ["anime", "trending"],
  queryFn: () => getTrendingAnime(),
  staleTime: HOUR,
});
export const popularAnimeQO = queryOptions({
  queryKey: ["anime", "popular"],
  queryFn: () => getPopularAnime(),
  staleTime: HOUR,
});
export const upcomingAnimeQO = queryOptions({
  queryKey: ["anime", "upcoming"],
  queryFn: () => getUpcomingAnime(),
  staleTime: HOUR,
});
export const seasonalAnimeQO = (season?: string, year?: number) =>
  queryOptions({
    queryKey: ["anime", "seasonal", season ?? "current", year ?? "current"],
    queryFn: () => getSeasonalAnime({ data: { season, year } }),
    staleTime: HOUR,
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
  });

export const searchMediaQO = (q: string) =>
  queryOptions({
    queryKey: ["search", q],
    queryFn: () => searchMedia({ data: { q } }),
    staleTime: 1000 * 60 * 5,
    enabled: q.trim().length >= 2,
  });
