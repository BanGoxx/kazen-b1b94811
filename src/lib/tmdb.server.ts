// Server-only TMDB REST access. Requires TMDB_API_KEY (v3 key) as a secret.
// Reads the key inside functions (never at module scope). Language fr-FR, region FR.
import { fromTmdbMovie, fromTmdbTv } from "./normalize";
import { resolvePlatform, dedupePlatforms } from "./platforms";
import type {
  CreditPerson,
  MediaDetail,
  MediaItem,
  Platform,
  RelatedMedia,
} from "./media-types";

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w92";

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
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return (await res.json()) as T;
}

type TmdbListResponse<T> = { results?: T[] };

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
): Promise<MediaItem[]> {
  const data = await tmdb<TmdbListResponse<Parameters<typeof fromTmdbTv>[0]>>(path, params);
  return (data?.results ?? []).map((m) => fromTmdbTv(m));
}

interface WatchProviders {
  "watch/providers"?: {
    results?: {
      FR?: {
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
  const out: Platform[] = [];
  const push = (arr: { provider_name: string; logo_path?: string | null }[] | undefined, type: Platform["type"]) => {
    for (const item of arr ?? []) {
      const p = resolvePlatform(item.provider_name, item.logo_path ? `${IMG}${item.logo_path}` : null, type);
      if (p) out.push(p);
    }
  };
  push(fr.flatrate, "stream");
  push(fr.buy, "buy");
  push(fr.rent, "rent");
  return dedupePlatforms(out);
}

export async function tmdbMovieDetail(id: number): Promise<MediaItem | null> {
  const data = await tmdb<Parameters<typeof fromTmdbMovie>[0] & WatchProviders>(
    `/movie/${id}`,
    { append_to_response: "watch/providers" },
  );
  if (!data) return null;
  return fromTmdbMovie(data, extractPlatforms(data));
}

export async function tmdbTvDetail(id: number): Promise<MediaItem | null> {
  const data = await tmdb<Parameters<typeof fromTmdbTv>[0] & WatchProviders>(
    `/tv/${id}`,
    { append_to_response: "watch/providers" },
  );
  if (!data) return null;
  return fromTmdbTv(data, extractPlatforms(data));
}

export async function tmdbSearch(q: string): Promise<MediaItem[]> {
  const data = await tmdb<TmdbListResponse<{ media_type?: string } & Record<string, unknown>>>(
    "/search/multi",
    { query: q, include_adult: "false" },
  );
  const out: MediaItem[] = [];
  for (const r of data?.results ?? []) {
    if (r.media_type === "movie") out.push(fromTmdbMovie(r as unknown as Parameters<typeof fromTmdbMovie>[0]));
    else if (r.media_type === "tv") out.push(fromTmdbTv(r as unknown as Parameters<typeof fromTmdbTv>[0]));
  }
  return out;
}
