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
      const items = await anilistList({ sort: "POPULARITY_DESC", season, seasonYear: year, perPage: 40 });
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
      anilistList({ sort: "SEARCH_MATCH", search: q, perPage: 12 }).catch((e) => {
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

export const getUpcomingAll = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    const [anime, movies] = await Promise.all([
      anilistList({ sort: "POPULARITY_DESC", status: "NOT_YET_RELEASED", perPage: 20 }).catch((e) => {
        console.error("getUpcomingAll anilist", e);
        return [] as MediaItem[];
      }),
      tmdbMovieList("/movie/upcoming", { region: "FR" }).catch((e) => {
        console.error("getUpcomingAll tmdb_movies", e);
        return [] as MediaItem[];
      }),
    ]);
    return [...anime, ...movies]
      .filter((m) => m.releaseDate)
      .sort((a, b) => (a.releaseDate! < b.releaseDate! ? -1 : 1));
  },
);
