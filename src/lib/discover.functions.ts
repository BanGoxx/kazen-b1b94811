import { createServerFn } from "@tanstack/react-start";
import type { MediaDetail, MediaItem } from "./media-types";
import { anilistList, anilistDetail, currentAnimeSeason, anilistSearchPaged } from "./anilist.server";
import {
  tmdbMovieList,
  tmdbTvList,
  tmdbMovieDetail,
  tmdbTvDetail,
  tmdbSearch,
  tmdbSearchPaged,
  tmdbAnimatedMovies,
} from "./tmdb.server";
import type { PagedMedia } from "./tmdb.server";
import { fallbackAnime, fallbackAnimePage, fallbackSeasonalAnime, fallbackAnimeDetail } from "./anime-fallback";

const SEASON_LABELS: Record<string, string> = {
  WINTER: "Hiver",
  SPRING: "Printemps",
  SUMMER: "Été",
  FALL: "Automne",
};

// ---------- Anime (AniList) ----------
//
// IMPORTANT: anime handlers never return [] for upstream failures. anilist.server
// already retries, uses L1/L2 stale cache, and times out slow calls. If AniList
// still answers 403/429 or the shared cache is cold, we serve a small curated
// anime fallback so Découverte, Anime and Saison never collapse into blank rows.

export const getTrendingAnime = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      const items = await anilistList({ sort: "TRENDING_DESC", perPage: 24 });
      return items.length ? items : fallbackAnime("trending", 24);
    } catch (e) {
      console.error("getTrendingAnime", e);
      return fallbackAnime("trending", 24);
    }
  },
);

export const getPopularAnime = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      const items = await anilistList({ sort: "POPULARITY_DESC", perPage: 24 });
      return items.length ? items : fallbackAnime("popular", 24);
    } catch (e) {
      console.error("getPopularAnime", e);
      return fallbackAnime("popular", 24);
    }
  },
);

export const getUpcomingAnime = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      const items = await anilistList({ sort: "POPULARITY_DESC", status: "NOT_YET_RELEASED", perPage: 24 });
      return items.length ? items : fallbackAnime("upcoming", 24);
    } catch (e) {
      console.error("getUpcomingAnime", e);
      return fallbackAnime("upcoming", 24);
    }
  },
);

export const getSeasonalAnime = createServerFn({ method: "GET" })
  .inputValidator((d: { season?: string; year?: number }) => d)
  .handler(async ({ data }): Promise<{ items: MediaItem[]; season: string; year: number; label: string }> => {
    const fallback = currentAnimeSeason();
    const season = data.season ?? fallback.season;
    const year = data.year ?? fallback.year;
    let items: MediaItem[];
    try {
      items = await anilistList({ sort: "POPULARITY_DESC", season, seasonYear: year, perPage: 50 });
    } catch (e) {
      console.error("getSeasonalAnime", e);
      const fallbackSeason = fallbackSeasonalAnime(50);
      return fallbackSeason;
    }
    if (!items.length) return fallbackSeasonalAnime(50);
    return { items, season, year, label: SEASON_LABELS[season] ?? season };
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
      return await tmdbTvList("/trending/tv/week", {}, true);
    } catch (e) {
      console.error("getTrendingSeries", e);
      return [];
    }
  },
);

export const getPopularSeries = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      return await tmdbTvList("/tv/popular", {}, true);
    } catch (e) {
      console.error("getPopularSeries", e);
      return [];
    }
  },
);

export const getOnAirSeries = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    try {
      return await tmdbTvList("/tv/on_the_air", {}, true);
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
      if (data.source === "anilist") {
        const detail = await anilistDetail(id);
        return detail ?? fallbackAnimeDetail(data.id);
      }
      if (data.source === "tmdb_movie") return await tmdbMovieDetail(id);
      if (data.source === "tmdb_tv") return await tmdbTvDetail(id);
      return null;
    } catch (e) {
      console.error("getMediaDetail", e);
      // Serve a curated fallback for known anime so a transient upstream
      // failure never turns a valid card into "Fiche introuvable".
      if (data.source === "anilist") return fallbackAnimeDetail(data.id);
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

export const searchMediaPaged = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string; page: number }) => d)
  .handler(
    async ({
      data,
    }): Promise<{
      anime: MediaItem[];
      series: MediaItem[];
      movies: MediaItem[];
      page: number;
      hasMore: boolean;
    }> => {
      const q = data.q.trim();
      const page = data.page && data.page > 0 ? data.page : 1;
      if (q.length < 2) return { anime: [], series: [], movies: [], page, hasMore: false };
      const [al, tm] = await Promise.all([
        anilistSearchPaged(q, page).catch((e) => {
          console.error("searchMediaPaged anilist", e);
          return { items: [] as MediaItem[], hasMore: false };
        }),
        tmdbSearchPaged(q, page).catch((e) => {
          console.error("searchMediaPaged tmdb", e);
          return { items: [] as MediaItem[], hasMore: false };
        }),
      ]);
      return {
        anime: al.items,
        series: tm.items.filter((m) => m.mediaType === "series"),
        movies: tm.items.filter((m) => m.mediaType === "movie"),
        page,
        hasMore: al.hasMore || tm.hasMore,
      };
    },
  );


// ---------- Upcoming (aggregated) ----------
//
// Correctness rules:
//  - Anime  -> AniList NOT_YET_RELEASED. AniList often ships partial start
//    dates (year only, or nothing at all) for announced titles, and sorting by
//    START_DATE puts those null-date rows first. We therefore query by
//    POPULARITY_DESC (surfaces real, mostly-dated upcoming anime) and NEVER
//    drop an upcoming anime just because its date is partial/missing — the
//    NOT_YET_RELEASED status already guarantees it is genuinely upcoming.
//  - Films  -> TMDB discover with primary_release_date >= today, ascending.
//  - Séries -> TMDB discover with first_air_date >= today, ascending.
// The final list is sorted so that titles with a concrete future date come
// first (soonest first); date-imprecise / undated titles trail at the end
// instead of disappearing. TMDB keeps its cache/retry guard and AniList keeps
// its request queue, so no 429 pressure.

// Sort key for an upcoming title: a concrete future date sorts by that date;
// missing or already-past-padded dates (e.g. a year-only title collapsed to
// Jan 1) sort last so they never crowd out precisely-dated releases — but they
// are still kept and shown.
function upcomingSortKey(m: MediaItem, today: string): string {
  return m.releaseDate && m.releaseDate >= today ? m.releaseDate : "9999-12-31";
}

export const getUpcomingAll = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    const today = new Date().toISOString().slice(0, 10);
    const [anime, movies1, movies2, series] = await Promise.all([
      anilistList({ sort: "POPULARITY_DESC", status: "NOT_YET_RELEASED", perPage: 50 }).then((items) => (
        items.length ? items : fallbackAnime("upcoming", 50)
      )).catch((e) => {
        console.error("getUpcomingAll anilist", e);
        return fallbackAnime("upcoming", 50);
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
      }, true).catch((e) => {
        console.error("getUpcomingAll tmdb_series", e);
        return [] as MediaItem[];
      }),
    ]);
    // Keep every upcoming anime (status guarantees future); only films/series
    // are date-gated at the source. Sort by soonest concrete date, undated last.
    const films = [...movies1, ...movies2, ...series].filter(
      (m) => m.releaseDate && m.releaseDate >= today,
    );
    return [...anime, ...films].sort((a, b) => {
      const ka = upcomingSortKey(a, today);
      const kb = upcomingSortKey(b, today);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  },
);


// ---------- Paginated catalogs ("voir plus") ----------
// Each returns a fixed page of results plus a hasMore flag. Pagination is
// sequential (one page per user click) so we never trigger parallel fetches,
// preserving AniList's request queue and TMDB's retry/cache safeguards.

const ANIME_SORTS: Record<string, { sort: string; status?: string }> = {
  trending: { sort: "TRENDING_DESC" },
  popular: { sort: "POPULARITY_DESC" },
  // "À venir": popularity surfaces real announced titles (AniList START_DATE
  // sorting front-loads null-date rows). We re-sort by soonest date client-side.
  upcoming: { sort: "POPULARITY_DESC", status: "NOT_YET_RELEASED" },
};

export const getSeasonalAnimePage = createServerFn({ method: "GET" })
  .inputValidator((d: { season?: string; year?: number; page: number }) => d)
  .handler(async ({ data }): Promise<PagedMedia> => {
    const fallback = currentAnimeSeason();
    const season = data.season ?? fallback.season;
    const year = data.year ?? fallback.year;
    try {
      const { anilistPaged } = await import("./anilist.server");
      const res = await anilistPaged({
        sort: "POPULARITY_DESC",
        season,
        seasonYear: year,
        page: data.page,
        perPage: 30,
      });
      if (!res.items.length && data.page === 1) {
        const fb = fallbackSeasonalAnime(50);
        return { items: fb.items, page: 1, hasMore: false };
      }
      return res;
    } catch (e) {
      console.error("getSeasonalAnimePage", e);
      if (data.page === 1) {
        const fb = fallbackSeasonalAnime(50);
        return { items: fb.items, page: 1, hasMore: false };
      }
      return { items: [], page: data.page, hasMore: false };
    }
  });

export const getAnimePage = createServerFn({ method: "GET" })
  .inputValidator((d: { kind: string; page: number }) => d)
  .handler(async ({ data }): Promise<PagedMedia> => {
    const cfg = ANIME_SORTS[data.kind] ?? ANIME_SORTS.trending;
    const { anilistPaged } = await import("./anilist.server");
    let res: PagedMedia;
    try {
      res = await anilistPaged({ ...cfg, page: data.page, perPage: 30 });
      if (!res.items.length && data.page === 1) res = fallbackAnimePage(data.kind, data.page, 30);
    } catch (e) {
      console.error("getAnimePage", e);
      res = fallbackAnimePage(data.kind, data.page, 30);
    }
    if (data.kind === "upcoming") {
      // Keep every upcoming anime (status guarantees future); do NOT drop
      // partial/undated titles. Sort soonest concrete date first, undated last.
      const today = new Date().toISOString().slice(0, 10);
      res.items = res.items.sort((a, b) => {
        const ka = upcomingSortKey(a, today);
        const kb = upcomingSortKey(b, today);
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });
    }
    return res;
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
      if (data.kind === "upcoming") {
        // Films "À venir": discover by ascending release date, future only.
        const today = new Date().toISOString().slice(0, 10);
        const res = await tmdbMoviePaged("/discover/movie", data.page, {
          region: "FR",
          sort_by: "primary_release_date.asc",
          "primary_release_date.gte": today,
          with_release_type: "2|3",
        });
        res.items = res.items.filter((m) => m.releaseDate && m.releaseDate >= today);
        return res;
      }
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
      return await tmdbTvPaged(path, data.page, {}, true);
    } catch (e) {
      console.error("getSeriesPage", e);
      return { items: [], page: data.page, hasMore: false };
    }
  });
