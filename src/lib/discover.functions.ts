import { createServerFn } from "@tanstack/react-start";
import type { MediaDetail, MediaItem } from "./media-types";
import { anilistList, anilistDetail, currentAnimeSeason } from "./anilist.server";
import {
  tmdbMovieList,
  tmdbTvList,
  tmdbMovieDetail,
  tmdbTvDetail,
  tmdbSearch,
  tmdbAnimatedMovies,
} from "./tmdb.server";
import type { PagedMedia } from "./tmdb.server";

const SEASON_LABELS: Record<string, string> = {
  WINTER: "Hiver",
  SPRING: "Printemps",
  SUMMER: "Été",
  FALL: "Automne",
};

// ---------- Anime (AniList) ----------

export const getTrendingAnime = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      return await anilistList({ sort: "TRENDING_DESC", perPage: 24 });
    } catch (e) {
      console.error("getTrendingAnime", e);
      return [];
    }
  },
);

export const getPopularAnime = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      return await anilistList({ sort: "POPULARITY_DESC", perPage: 24 });
    } catch (e) {
      console.error("getPopularAnime", e);
      return [];
    }
  },
);

export const getUpcomingAnime = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      return await anilistList({ sort: "POPULARITY_DESC", status: "NOT_YET_RELEASED", perPage: 24 });
    } catch (e) {
      console.error("getUpcomingAnime", e);
      return [];
    }
  },
);

export const getSeasonalAnime = createServerFn({ method: "GET" })
  .inputValidator((d: { season?: string; year?: number }) => d)
  .handler(async ({ data }): Promise<{ items: MediaItem[]; season: string; year: number; label: string }> => {
    const fallback = currentAnimeSeason();
    const season = data.season ?? fallback.season;
    const year = data.year ?? fallback.year;
    try {
      const items = await anilistList({ sort: "POPULARITY_DESC", season, seasonYear: year, perPage: 50 });
      return { items, season, year, label: SEASON_LABELS[season] ?? season };
    } catch (e) {
      console.error("getSeasonalAnime", e);
      return { items: [], season, year, label: SEASON_LABELS[season] ?? season };
    }
  });

// ---------- Movies / Series (TMDB) ----------

export const getTrendingMovies = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      return await tmdbMovieList("/trending/movie/week", { region: "FR" });
    } catch (e) {
      console.error("getTrendingMovies", e);
      return [];
    }
  },
);

export const getPopularMovies = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      return await tmdbMovieList("/movie/popular", { region: "FR" });
    } catch (e) {
      console.error("getPopularMovies", e);
      return [];
    }
  },
);

export const getUpcomingMovies = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      return await tmdbMovieList("/movie/upcoming", { region: "FR" });
    } catch (e) {
      console.error("getUpcomingMovies", e);
      return [];
    }
  },
);

export const getTrendingSeries = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      return await tmdbTvList("/trending/tv/week", {});
    } catch (e) {
      console.error("getTrendingSeries", e);
      return [];
    }
  },
);

export const getPopularSeries = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      return await tmdbTvList("/tv/popular", {});
    } catch (e) {
      console.error("getPopularSeries", e);
      return [];
    }
  },
);

export const getOnAirSeries = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      return await tmdbTvList("/tv/on_the_air", {});
    } catch (e) {
      console.error("getOnAirSeries", e);
      return [];
    }
  },
);

// ---------- Animated films (TMDB Discover, genre 16) ----------

export const getAnimatedMovies = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      return await tmdbAnimatedMovies();
    } catch (e) {
      console.error("getAnimatedMovies", e);
      return [];
    }
  },
);

export const getAsianAnimationMovies = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      return await tmdbAnimatedMovies("JP,CN,KR");
    } catch (e) {
      console.error("getAsianAnimationMovies", e);
      return [];
    }
  },
);

// ---------- Detail ----------

export const getMediaDetail = createServerFn({ method: "GET" })
  .inputValidator((d: { source: string; id: string }) => d)
  .handler(async ({ data }): Promise<MediaDetail | null> => {
    const id = Number(data.id);
    if (!Number.isFinite(id)) return null;
    try {
      if (data.source === "anilist") return await anilistDetail(id);
      if (data.source === "tmdb_movie") return await tmdbMovieDetail(id);
      if (data.source === "tmdb_tv") return await tmdbTvDetail(id);
      return null;
    } catch (e) {
      console.error("getMediaDetail", e);
      return null;
    }
  });

// ---------- Search ----------

export const searchMedia = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }): Promise<{ anime: MediaItem[]; series: MediaItem[]; movies: MediaItem[] }> => {
    const q = data.q.trim();
    if (q.length < 2) return { anime: [], series: [], movies: [] };
    const [anime, tmdb] = await Promise.all([
      anilistList({ sort: "SEARCH_MATCH", search: q, perPage: 24 }).catch((e) => {
        console.error("searchMedia anilist", e);
        return [] as MediaItem[];
      }),
      tmdbSearch(q).catch((e) => {
        console.error("searchMedia tmdb", e);
        return [] as MediaItem[];
      }),
    ]);
    return {
      anime,
      series: tmdb.filter((m) => m.mediaType === "series"),
      movies: tmdb.filter((m) => m.mediaType === "movie"),
    };
  });

// ---------- Upcoming (aggregated) ----------
//
// Correctness rules:
//  - Anime  -> AniList NOT_YET_RELEASED, ordered by START_DATE (soonest first).
//  - Films  -> TMDB discover with primary_release_date >= today, ascending.
//  - Séries -> TMDB discover with first_air_date >= today, ascending.
// We then keep only titles whose date is today or later and sort the whole
// aggregate ascending, so the very next release is always on top (no stray
// "mars 1963" old dates). All three sources run in parallel; TMDB keeps its
// cache/retry guard and AniList keeps its request queue, so no 429 pressure.

export const getUpcomingAll = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    const today = new Date().toISOString().slice(0, 10);
    const [anime, movies1, movies2, series] = await Promise.all([
      anilistList({ sort: "START_DATE", status: "NOT_YET_RELEASED", perPage: 50 }).catch((e) => {
        console.error("getUpcomingAll anilist", e);
        return [] as MediaItem[];
      }),
      tmdbMovieList("/discover/movie", {
        region: "FR",
        sort_by: "primary_release_date.asc",
        "primary_release_date.gte": today,
        with_release_type: "2|3",
        "vote_count.gte": "0",
      }).catch((e) => {
        console.error("getUpcomingAll tmdb_movies_1", e);
        return [] as MediaItem[];
      }),
      tmdbMovieList("/discover/movie", {
        region: "FR",
        page: "2",
        sort_by: "primary_release_date.asc",
        "primary_release_date.gte": today,
        with_release_type: "2|3",
        "vote_count.gte": "0",
      }).catch(() => [] as MediaItem[]),
      tmdbTvList("/discover/tv", {
        sort_by: "first_air_date.asc",
        "first_air_date.gte": today,
      }).catch((e) => {
        console.error("getUpcomingAll tmdb_series", e);
        return [] as MediaItem[];
      }),
    ]);
    return [...anime, ...movies1, ...movies2, ...series]
      .filter((m) => m.releaseDate && m.releaseDate >= today)
      .sort((a, b) => (a.releaseDate! < b.releaseDate! ? -1 : a.releaseDate! > b.releaseDate! ? 1 : 0));
  },
);

// ---------- Paginated catalogs ("voir plus") ----------
// Each returns a fixed page of results plus a hasMore flag. Pagination is
// sequential (one page per user click) so we never trigger parallel fetches,
// preserving AniList's request queue and TMDB's retry/cache safeguards.

const ANIME_SORTS: Record<string, { sort: string; status?: string }> = {
  trending: { sort: "TRENDING_DESC" },
  popular: { sort: "POPULARITY_DESC" },
  upcoming: { sort: "POPULARITY_DESC", status: "NOT_YET_RELEASED" },
};

export const getAnimePage = createServerFn({ method: "GET" })
  .inputValidator((d: { kind: string; page: number }) => d)
  .handler(async ({ data }): Promise<PagedMedia> => {
    const cfg = ANIME_SORTS[data.kind] ?? ANIME_SORTS.trending;
    try {
      const { anilistPaged } = await import("./anilist.server");
      return await anilistPaged({ ...cfg, page: data.page, perPage: 30 });
    } catch (e) {
      console.error("getAnimePage", e);
      return { items: [], page: data.page, hasMore: false };
    }
  });

const MOVIE_PATHS: Record<string, string> = {
  trending: "/trending/movie/week",
  popular: "/movie/popular",
  upcoming: "/movie/upcoming",
};

export const getMoviePage = createServerFn({ method: "GET" })
  .inputValidator((d: { kind: string; page: number }) => d)
  .handler(async ({ data }): Promise<PagedMedia> => {
    try {
      const { tmdbMoviePaged, tmdbAnimatedMoviesPaged } = await import("./tmdb.server");
      if (data.kind === "animated") return await tmdbAnimatedMoviesPaged(data.page);
      if (data.kind === "asian") return await tmdbAnimatedMoviesPaged(data.page, "JP,CN,KR");
      const path = MOVIE_PATHS[data.kind] ?? MOVIE_PATHS.trending;
      return await tmdbMoviePaged(path, data.page, { region: "FR" });
    } catch (e) {
      console.error("getMoviePage", e);
      return { items: [], page: data.page, hasMore: false };
    }
  });

const SERIES_PATHS: Record<string, string> = {
  trending: "/trending/tv/week",
  popular: "/tv/popular",
  onair: "/tv/on_the_air",
};

export const getSeriesPage = createServerFn({ method: "GET" })
  .inputValidator((d: { kind: string; page: number }) => d)
  .handler(async ({ data }): Promise<PagedMedia> => {
    try {
      const { tmdbTvPaged } = await import("./tmdb.server");
      const path = SERIES_PATHS[data.kind] ?? SERIES_PATHS.trending;
      return await tmdbTvPaged(path, data.page);
    } catch (e) {
      console.error("getSeriesPage", e);
      return { items: [], page: data.page, hasMore: false };
    }
  });
