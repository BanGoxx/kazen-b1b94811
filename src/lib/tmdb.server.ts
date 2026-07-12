// Server-only TMDB REST access. Requires TMDB_API_KEY (v3 key) as a secret.
// Reads the key inside functions (never at module scope). Language fr-FR, region FR.
import { fromTmdbMovie, fromTmdbTv, isAsianAnimationTv } from "./normalize";
import { resolvePlatform, dedupePlatforms } from "./platforms";
import type {
  CreditPerson,
  MediaDetail,
  MediaVideo,
  MediaItem,
  Platform,
  RelatedMedia,
} from "./media-types";

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w92";
const CACHE_TTL_MS = 1000 * 60 * 20;
const STALE_TTL_MS = 1000 * 60 * 60 * 6;

type TmdbCacheEntry = { value: unknown; expiresAt: number; staleUntil: number; pending?: Promise<unknown> };
const tmdbCache = new Map<string, TmdbCacheEntry>();

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function hasTmdbKey(): boolean {
  return Boolean(process.env.TMDB_API_KEY);
}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("language", "fr-FR");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const cacheId = `${path}?${new URLSearchParams(params).toString()}`;
  const now = Date.now();
  const cached = tmdbCache.get(cacheId);

  if (cached && cached.expiresAt > now) return cached.value as T;
  if (cached?.pending) return cached.pending as Promise<T>;

  const pending = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await fetch(url.toString());
        if ((res.status === 429 || res.status >= 500) && attempt < 2) {
          const retryAfter = Number(res.headers.get("retry-after"));
          await wait(Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 2000) : 500 * (attempt + 1));
          continue;
        }
        if (!res.ok) throw new Error(`TMDB ${res.status}`);
        const value = (await res.json()) as T;
        tmdbCache.set(cacheId, { value, expiresAt: Date.now() + CACHE_TTL_MS, staleUntil: Date.now() + STALE_TTL_MS });
        return value;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await wait(400 * (attempt + 1));
      }
    }
    if (cached && cached.staleUntil > Date.now()) {
      console.error("TMDB source indisponible, cache récent conservé", lastError);
      return cached.value as T;
    }
    throw lastError instanceof Error ? lastError : new Error("TMDB request failed");
  })();

  tmdbCache.set(cacheId, {
    value: cached?.value,
    expiresAt: cached?.expiresAt ?? 0,
    staleUntil: cached?.staleUntil ?? 0,
    pending,
  });
  try {
    return await pending;
  } finally {
    const latest = tmdbCache.get(cacheId);
    if (latest?.pending === pending) {
      tmdbCache.set(cacheId, { value: latest.value, expiresAt: latest.expiresAt, staleUntil: latest.staleUntil });
    }
  }
}

type TmdbListResponse<T> = { results?: T[]; page?: number; total_pages?: number };

export type PagedMedia = { items: MediaItem[]; page: number; hasMore: boolean };

export async function tmdbMovieList(
  path: string,
  params: Record<string, string> = {},
): Promise<MediaItem[]> {
  const data = await tmdb<TmdbListResponse<Parameters<typeof fromTmdbMovie>[0]>>(path, params);
  return (data?.results ?? []).map((m) => fromTmdbMovie(m));
}

export async function tmdbTvList(
  path: string,
  params: Record<string, string> = {},
  filterAnime = false,
): Promise<MediaItem[]> {
  const data = await tmdb<TmdbListResponse<Parameters<typeof fromTmdbTv>[0]>>(path, params);
  let results = data?.results ?? [];
  if (filterAnime) results = results.filter((m) => !isAsianAnimationTv(m));
  return results.map((m) => fromTmdbTv(m));
}

export async function tmdbMoviePaged(
  path: string,
  page: number,
  params: Record<string, string> = {},
): Promise<PagedMedia> {
  const data = await tmdb<TmdbListResponse<Parameters<typeof fromTmdbMovie>[0]>>(path, {
    ...params,
    page: String(page),
  });
  return {
    items: (data?.results ?? []).map((m) => fromTmdbMovie(m)),
    page: data?.page ?? page,
    hasMore: (data?.page ?? page) < (data?.total_pages ?? page),
  };
}

export async function tmdbTvPaged(
  path: string,
  page: number,
  params: Record<string, string> = {},
  filterAnime = false,
): Promise<PagedMedia> {
  const data = await tmdb<TmdbListResponse<Parameters<typeof fromTmdbTv>[0]>>(path, {
    ...params,
    page: String(page),
  });
  let results = data?.results ?? [];
  if (filterAnime) results = results.filter((m) => !isAsianAnimationTv(m));
  return {
    items: results.map((m) => fromTmdbTv(m)),
    page: data?.page ?? page,
    hasMore: (data?.page ?? page) < (data?.total_pages ?? page),
  };
}

export async function tmdbAnimatedMoviesPaged(page: number, origin?: string): Promise<PagedMedia> {
  const params: Record<string, string> = {
    with_genres: "16",
    sort_by: "popularity.desc",
    "vote_count.gte": "40",
    include_adult: "false",
    page: String(page),
  };
  if (origin) params.with_origin_country = origin;
  const data = await tmdb<TmdbListResponse<Parameters<typeof fromTmdbMovie>[0]>>(
    "/discover/movie",
    params,
  );
  return {
    items: (data?.results ?? []).map((m) => fromTmdbMovie(m)),
    page: data?.page ?? page,
    hasMore: (data?.page ?? page) < (data?.total_pages ?? page),
  };
}

interface WatchProviders {
  "watch/providers"?: {
    results?: {
      FR?: {
        link?: string | null;
        flatrate?: { provider_name: string; logo_path?: string | null }[];
        buy?: { provider_name: string; logo_path?: string | null }[];
        rent?: { provider_name: string; logo_path?: string | null }[];
      };
    };
  };
}

function extractPlatforms(wp: WatchProviders): Platform[] {
  const fr = wp["watch/providers"]?.results?.FR;
  if (!fr) return [];
  // TMDB exposes an aggregated JustWatch page per title & region — the closest
  // thing to a deep link. Used as the redirection target for every provider.
  const link = fr.link ?? null;
  const out: Platform[] = [];
  const push = (arr: { provider_name: string; logo_path?: string | null }[] | undefined, type: Platform["type"]) => {
    for (const item of arr ?? []) {
      const p = resolvePlatform(item.provider_name, item.logo_path ? `${IMG}${item.logo_path}` : null, type, link);
      if (p) out.push(p);
    }
  };
  push(fr.flatrate, "stream");
  push(fr.buy, "buy");
  push(fr.rent, "rent");
  return dedupePlatforms(out);
}

// French synopsis strategy: primary calls request language=fr-FR. When TMDB
// has no French overview it returns an empty string, so we fall back to the
// original/English overview rather than showing nothing.
async function overviewFallback(
  kind: "movie" | "tv",
  id: number,
  current: string | null,
): Promise<string | null> {
  if (current && current.trim()) return current;
  const en = await tmdb<{ overview?: string | null }>(`/${kind}/${id}`, { language: "en-US" }).catch(
    () => null,
  );
  return en?.overview?.trim() || current;
}

export async function tmdbMovieDetail(id: number): Promise<MediaDetail | null> {
  const data = await tmdb<Parameters<typeof fromTmdbMovie>[0] & TmdbExtra & WatchProviders & {
    belongs_to_collection?: { name?: string } | null;
    origin_country?: string[] | null;
    production_countries?: { iso_3166_1?: string; name?: string }[] | null;
    original_title?: string | null;
    release_dates?: { results?: { iso_3166_1?: string; release_dates?: { certification?: string }[] }[] } | null;
  }>(
    `/movie/${id}`,
    { append_to_response: "watch/providers,credits,videos,recommendations,release_dates" },
  );
  if (!data) return null;
  const bmedia = fromTmdbMovie(data, extractPlatforms(data));
  bmedia.synopsis = await overviewFallback("movie", id, bmedia.synopsis);
  return augmentTmdb(bmedia, data, "movie", {
    collectionName: data.belongs_to_collection?.name ?? null,
    format: "Film",
    countryOfOrigin: tmdbCountry(data.origin_country, data.production_countries),
    ageRating: tmdbMovieCert(data.release_dates),
    titleAlternatives: [data.original_title].filter((t): t is string => !!t && t !== bmedia.title),
    endDate: null,
  });
}

export async function tmdbTvDetail(id: number): Promise<MediaDetail | null> {
  const data = await tmdb<Parameters<typeof fromTmdbTv>[0] & TmdbExtra & WatchProviders & {
    networks?: { name?: string }[] | null;
    origin_country?: string[] | null;
    production_countries?: { iso_3166_1?: string; name?: string }[] | null;
    original_name?: string | null;
    last_air_date?: string | null;
    content_ratings?: { results?: { iso_3166_1?: string; rating?: string }[] } | null;
  }>(
    `/tv/${id}`,
    { append_to_response: "watch/providers,credits,videos,recommendations,content_ratings" },
  );
  if (!data) return null;
  const bmedia = fromTmdbTv(data, extractPlatforms(data));
  bmedia.synopsis = await overviewFallback("tv", id, bmedia.synopsis);
  return augmentTmdb(bmedia, data, "tv", {
    studios: (data.networks ?? []).map((n) => n.name ?? "").filter(Boolean),
    format: "Série",
    countryOfOrigin: tmdbCountry(data.origin_country, data.production_countries),
    ageRating: tmdbTvCert(data.content_ratings),
    titleAlternatives: [data.original_name].filter((t): t is string => !!t && t !== bmedia.title),
    endDate: data.last_air_date ?? null,
  });
}

interface TmdbExtra {
  credits?: {
    cast?: { id: number; name: string; character?: string | null; profile_path?: string | null }[];
    crew?: { id: number; name: string; job?: string | null; profile_path?: string | null }[];
  } | null;
  videos?: { results?: { key: string; site: string; type: string; official?: boolean }[] } | null;
  recommendations?: { results?: Record<string, unknown>[] } | null;
}

const TMDB_PROFILE = "https://image.tmdb.org/t/p/w185";
const IMPORTANT_JOBS = ["Director", "Screenplay", "Writer", "Creator", "Producer", "Original Music Composer"];

const TMDB_COUNTRY_LABELS: Record<string, string> = {
  JP: "Japon",
  CN: "Chine",
  KR: "Corée du Sud",
  US: "États-Unis",
  FR: "France",
  GB: "Royaume-Uni",
  DE: "Allemagne",
  ES: "Espagne",
  IT: "Italie",
};

function tmdbCountry(
  origin?: string[] | null,
  production?: { iso_3166_1?: string; name?: string }[] | null,
): string | null {
  const code = origin?.[0] ?? production?.[0]?.iso_3166_1;
  if (!code) return production?.[0]?.name ?? null;
  return TMDB_COUNTRY_LABELS[code] ?? production?.[0]?.name ?? code;
}

function tmdbMovieCert(
  rd?: { results?: { iso_3166_1?: string; release_dates?: { certification?: string }[] }[] } | null,
): string | null {
  const results = rd?.results ?? [];
  const pick = (code: string) => results.find((r) => r.iso_3166_1 === code);
  const entry = pick("FR") ?? pick("US") ?? results[0];
  const cert = entry?.release_dates?.map((d) => d.certification).find((c) => c && c.trim());
  return cert ? cert.trim() : null;
}

function tmdbTvCert(
  cr?: { results?: { iso_3166_1?: string; rating?: string }[] } | null,
): string | null {
  const results = cr?.results ?? [];
  const pick = (code: string) => results.find((r) => r.iso_3166_1 === code);
  const entry = pick("FR") ?? pick("US") ?? results.find((r) => r.rating && r.rating.trim());
  return entry?.rating?.trim() || null;
}

const TMDB_VIDEO_LABELS: Record<string, string> = {
  Trailer: "Bande-annonce",
  Teaser: "Teaser",
  Clip: "Extrait",
  Featurette: "Featurette",
  "Behind the Scenes": "Coulisses",
};

function augmentTmdb(
  bmedia: MediaItem,
  data: TmdbExtra,
  kind: "movie" | "tv",
  extra: {
    collectionName?: string | null;
    studios?: string[];
    format: string;
    countryOfOrigin?: string | null;
    ageRating?: string | null;
    titleAlternatives?: string[];
    endDate?: string | null;
  },
): MediaDetail {
  const cast: CreditPerson[] = (data.credits?.cast ?? []).slice(0, 14).map((c) => ({
    id: `c${c.id}`,
    name: c.name,
    role: c.character ?? null,
    photoUrl: c.profile_path ? `${TMDB_PROFILE}${c.profile_path}` : null,
  }));
  const crew: CreditPerson[] = (data.credits?.crew ?? [])
    .filter((c) => c.job && IMPORTANT_JOBS.includes(c.job))
    .slice(0, 10)
    .map((c) => ({
      id: `s${c.id}-${c.job}`,
      name: c.name,
      role: c.job ?? null,
      photoUrl: c.profile_path ? `${TMDB_PROFILE}${c.profile_path}` : null,
    }));
  const trailer = (data.videos?.results ?? []).find(
    (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"),
  );
  const related: RelatedMedia[] = (data.recommendations?.results ?? [])
    .slice(0, 12)
    .map((r) => (kind === "movie" ? fromTmdbMovie(r as unknown as Parameters<typeof fromTmdbMovie>[0]) : fromTmdbTv(r as unknown as Parameters<typeof fromTmdbTv>[0])))
    .map((m) => ({
      key: m.key,
      source: m.source,
      externalId: m.externalId,
      title: m.title,
      posterUrl: m.posterUrl,
      relation: "Recommandé",
      relationCategory: "recommendation" as const,
      mediaType: m.mediaType,
      format: null,
    }));
  const videos: MediaVideo[] = (data.videos?.results ?? [])
    .filter((v) => v.site === "YouTube")
    .slice(0, 8)
    .map((v) => ({
      key: v.key,
      label: TMDB_VIDEO_LABELS[v.type] ?? v.type,
      url: `https://www.youtube.com/embed/${v.key}`,
    }));
  return {
    ...bmedia,
    trailerUrl: trailer ? `https://www.youtube.com/embed/${trailer.key}` : null,
    format: extra.format,
    seasonLabel: null,
    studios: extra.studios ?? [],
    popularity: null,
    castLabel: "Casting",
    cast,
    crewLabel: kind === "movie" ? "Réalisation & scénario" : "Création",
    crew,
    related,
    collectionName: extra.collectionName ?? null,
    titleAlternatives: extra.titleAlternatives ?? [],
    originSource: null,
    ageRating: extra.ageRating ?? null,
    countryOfOrigin: extra.countryOfOrigin ?? null,
    endDate: extra.endDate ?? null,
    videos,
  };
}

/**
 * Animated feature films via TMDB Discover (genre 16 = Animation).
 * `origin` narrows to a country of origin (e.g. "JP,CN" for Asian animation,
 * "FR" for French animation). Returns [] gracefully when TMDB is absent.
 */
export async function tmdbAnimatedMovies(origin?: string): Promise<MediaItem[]> {
  const params: Record<string, string> = {
    with_genres: "16",
    sort_by: "popularity.desc",
    "vote_count.gte": "40",
    include_adult: "false",
  };
  if (origin) params.with_origin_country = origin;
  const data = await tmdb<TmdbListResponse<Parameters<typeof fromTmdbMovie>[0]>>(
    "/discover/movie",
    params,
  );
  return (data?.results ?? []).map((m) => fromTmdbMovie(m));
}

export async function tmdbSearch(q: string): Promise<MediaItem[]> {
  // Fetch the first two result pages sequentially (cached, retry-guarded) for a
  // richer, deeper result set without triggering parallel API pressure.
  const out: MediaItem[] = [];
  for (let page = 1; page <= 2; page += 1) {
    const data = await tmdb<TmdbListResponse<{ media_type?: string } & Record<string, unknown>>>(
      "/search/multi",
      { query: q, include_adult: "false", page: String(page) },
    );
    for (const r of data?.results ?? []) {
      if (r.media_type === "movie") out.push(fromTmdbMovie(r as unknown as Parameters<typeof fromTmdbMovie>[0]));
      else if (r.media_type === "tv") out.push(fromTmdbTv(r as unknown as Parameters<typeof fromTmdbTv>[0]));
    }
    if ((data?.page ?? page) >= (data?.total_pages ?? page)) break;
  }
  return out;
}

