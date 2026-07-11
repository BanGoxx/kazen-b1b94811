import type { MediaItem, MediaStatus } from "./media-types";
import { dedupePlatforms, resolvePlatform } from "./platforms";
import type { Platform } from "./media-types";

// ---------- AniList ----------

interface AniListMedia {
  id: number;
  title?: { romaji?: string | null; english?: string | null; native?: string | null } | null;
  description?: string | null;
  coverImage?: { extraLarge?: string | null; large?: string | null } | null;
  bannerImage?: string | null;
  genres?: string[] | null;
  averageScore?: number | null;
  status?: string | null;
  episodes?: number | null;
  duration?: number | null;
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  nextAiringEpisode?: { episode?: number | null; airingAt?: number | null } | null;
  externalLinks?: { site?: string | null; url?: string | null; type?: string | null }[] | null;
}

function stripHtml(input: string | null | undefined): string | null {
  if (!input) return null;
  return input.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() || null;
}

function aniListDate(d?: AniListMedia["startDate"]): string | null {
  if (!d?.year) return null;
  const m = String(d.month ?? 1).padStart(2, "0");
  const day = String(d.day ?? 1).padStart(2, "0");
  return `${d.year}-${m}-${day}`;
}

function aniListStatus(status?: string | null): MediaStatus | null {
  switch (status) {
    case "NOT_YET_RELEASED":
      return "a_venir";
    case "RELEASING":
      return "en_cours";
    case "FINISHED":
      return "termine";
    default:
      return null;
  }
}

export function fromAniList(m: AniListMedia): MediaItem {
  const platforms: Platform[] = [];
  for (const link of m.externalLinks ?? []) {
    if (!link?.site) continue;
    const p = resolvePlatform(link.site, null, "stream");
    if (p) platforms.push(p);
  }
  return {
    key: `anilist:${m.id}`,
    source: "anilist",
    externalId: String(m.id),
    mediaType: "anime",
    title: m.title?.english || m.title?.romaji || m.title?.native || "Sans titre",
    titleOriginal: m.title?.native || m.title?.romaji || null,
    synopsis: stripHtml(m.description),
    posterUrl: m.coverImage?.extraLarge || m.coverImage?.large || null,
    backdropUrl: m.bannerImage || null,
    genres: m.genres ?? [],
    score: m.averageScore ?? null,
    status: aniListStatus(m.status),
    releaseDate: aniListDate(m.startDate),
    nextEpisode:
      m.nextAiringEpisode?.airingAt && m.nextAiringEpisode?.episode
        ? {
            number: m.nextAiringEpisode.episode,
            airDate: new Date(m.nextAiringEpisode.airingAt * 1000).toISOString(),
          }
        : null,
    episodesCount: m.episodes ?? null,
    seasonsCount: null,
    runtime: m.duration ?? null,
    platforms: dedupePlatforms(platforms),
  };
}

// ---------- TMDB ----------

const TMDB_IMG = "https://image.tmdb.org/t/p";

interface TmdbBase {
  id: number;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number | null;
  genre_ids?: number[] | null;
  genres?: { id: number; name: string }[] | null;
}

interface TmdbMovie extends TmdbBase {
  title?: string | null;
  original_title?: string | null;
  release_date?: string | null;
  runtime?: number | null;
}

interface TmdbTv extends TmdbBase {
  name?: string | null;
  original_name?: string | null;
  first_air_date?: string | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  episode_run_time?: number[] | null;
}

// TMDB genre id -> FR name (subset; full list resolved when genres[] present).
const TMDB_GENRES: Record<number, string> = {
  28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie", 80: "Crime",
  99: "Documentaire", 18: "Drame", 10751: "Familial", 14: "Fantastique",
  36: "Histoire", 27: "Horreur", 10402: "Musique", 9648: "Mystère",
  10749: "Romance", 878: "Science-Fiction", 10770: "Téléfilm", 53: "Thriller",
  10752: "Guerre", 37: "Western", 10759: "Action & Aventure",
  10762: "Enfants", 10763: "Info", 10764: "Télé-réalité", 10765: "SF & Fantastique",
  10766: "Feuilleton", 10767: "Talk", 10768: "Guerre & Politique",
};

function tmdbGenres(b: TmdbBase): string[] {
  if (b.genres?.length) return b.genres.map((g) => g.name);
  return (b.genre_ids ?? []).map((id) => TMDB_GENRES[id]).filter(Boolean);
}

function tmdbImg(path: string | null | undefined, size: string): string | null {
  return path ? `${TMDB_IMG}/${size}${path}` : null;
}

function tmdbStatus(date: string | null | undefined): MediaStatus | null {
  if (!date) return null;
  return new Date(date).getTime() > Date.now() ? "a_venir" : "termine";
}

export function fromTmdbMovie(m: TmdbMovie, platforms: Platform[] = []): MediaItem {
  return {
    key: `tmdb_movie:${m.id}`,
    source: "tmdb_movie",
    externalId: String(m.id),
    mediaType: "movie",
    title: m.title || m.original_title || "Sans titre",
    titleOriginal: m.original_title || null,
    synopsis: m.overview?.trim() || null,
    posterUrl: tmdbImg(m.poster_path, "w500"),
    backdropUrl: tmdbImg(m.backdrop_path, "w1280"),
    genres: tmdbGenres(m),
    score: m.vote_average ? Math.round(m.vote_average * 10) : null,
    status: tmdbStatus(m.release_date),
    releaseDate: m.release_date || null,
    nextEpisode: null,
    episodesCount: null,
    seasonsCount: null,
    runtime: m.runtime ?? null,
    platforms: dedupePlatforms(platforms),
  };
}

export function fromTmdbTv(m: TmdbTv, platforms: Platform[] = []): MediaItem {
  return {
    key: `tmdb_tv:${m.id}`,
    source: "tmdb_tv",
    externalId: String(m.id),
    mediaType: "series",
    title: m.name || m.original_name || "Sans titre",
    titleOriginal: m.original_name || null,
    synopsis: m.overview?.trim() || null,
    posterUrl: tmdbImg(m.poster_path, "w500"),
    backdropUrl: tmdbImg(m.backdrop_path, "w1280"),
    genres: tmdbGenres(m),
    score: m.vote_average ? Math.round(m.vote_average * 10) : null,
    status: tmdbStatus(m.first_air_date),
    releaseDate: m.first_air_date || null,
    nextEpisode: null,
    episodesCount: m.number_of_episodes ?? null,
    seasonsCount: m.number_of_seasons ?? null,
    runtime: m.episode_run_time?.[0] ?? null,
    platforms: dedupePlatforms(platforms),
  };
}
