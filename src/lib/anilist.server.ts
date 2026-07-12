// Server-only AniList GraphQL access. AniList is a public keyless GraphQL API.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fromAniList } from "./normalize";
import type {
  CreditPerson,
  MediaDetail,
  MediaItem,
  RelatedMedia,
} from "./media-types";

const ENDPOINT = "https://graphql.anilist.co";
const CACHE_TTL_MS = 1000 * 60 * 20;
const STALE_TTL_MS = 1000 * 60 * 60 * 24;
const REQUEST_TIMEOUT_MS = 6500;

// Shared (cross-isolate) cache. In-memory cache is L1 (fast, per worker
// isolate); Postgres (via SECURITY DEFINER RPCs) is L2 — survives cold starts
// and worker restarts so anime payloads fetched by one isolate are reused by
// all others, which is the main defense against AniList 429s in production.
// Reads are open (public anime metadata only); writes require a server-only
// token (read at call time), since the Data API treats our worker as anon.

type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  staleUntil: number;
  pending?: Promise<T>;
};

const queryCache = new Map<string, CacheEntry<unknown>>();
let anilistQueue = Promise.resolve();
let lastAniListRequestAt = 0;

function cacheKey(gql: string, variables: Record<string, unknown>): string {
  // 64-bit-ish FNV-1a of the full query+vars, kept short so it fits a text PK
  // index comfortably. Collisions across our small query set are negligible.
  const raw = JSON.stringify({ gql, variables });
  let h1 = 0x811c9dc5;
  let h2 = 0xc2b2ae35;
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b);
  }
  return `al_${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}

// L2 read — never throws; a cache miss/failure just falls through to fetch.
async function readSharedCache<T>(
  key: string,
): Promise<{ value: T; fetchedAt: number } | null> {
  try {
    const { data, error } = await (supabaseAdmin as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{
        data: Array<{ payload: unknown; fetched_at: string }> | null;
        error: unknown;
      }>;
    }).rpc("anilist_cache_get", { p_key: key });
    if (error || !data || !data[0]) return null;
    return {
      value: data[0].payload as T,
      fetchedAt: new Date(data[0].fetched_at).getTime(),
    };
  } catch {
    return null;
  }
}

// L2 write — fire-and-forget; a failure must never break a request. Requires
// the server-only token, read at call time (env is injected per request on
// Workers), so browser/anon callers can never write to the shared cache.
async function writeSharedCache(key: string, value: unknown): Promise<void> {
  const token = process.env.ANILIST_CACHE_TOKEN;
  if (!token) return;
  try {
    await (supabaseAdmin as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
    }).rpc("anilist_cache_put", { p_key: key, p_payload: value, p_token: token });
  } catch {
    /* ignore cache write failures */

  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(ENDPOINT, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function queuedAniListFetch(init: RequestInit): Promise<Response> {
  const run = anilistQueue.then(async () => {
    const elapsed = Date.now() - lastAniListRequestAt;
    if (elapsed < 450) await wait(450 - elapsed);
    lastAniListRequestAt = Date.now();
    return fetchWithTimeout(init);
  });
  anilistQueue = run.then(() => undefined, () => undefined);
  return run;
}

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  description(asHtml: false)
  coverImage { extraLarge large }
  bannerImage
  genres
  averageScore
  status
  episodes
  duration
  startDate { year month day }
  nextAiringEpisode { episode airingAt }
  externalLinks { site url type }
`;

async function query<T>(gql: string, variables: Record<string, unknown>): Promise<T> {
  const key = cacheKey(gql, variables);
  const now = Date.now();
  const cached = queryCache.get(key) as CacheEntry<T> | undefined;

  if (cached?.value && cached.expiresAt > now) return cached.value;
  if (cached?.pending) return cached.pending;

  const pending = (async () => {
    // L2: reuse a fresh payload another isolate already fetched. This is what
    // keeps anime rows populated across cold starts without hitting AniList.
    const shared = await readSharedCache<T>(key);
    if (shared && Date.now() - shared.fetchedAt < CACHE_TTL_MS) {
      queryCache.set(key, {
        value: shared.value,
        expiresAt: shared.fetchedAt + CACHE_TTL_MS,
        staleUntil: shared.fetchedAt + STALE_TTL_MS,
        pending: queryCache.get(key)?.pending,
      });
      return shared.value;
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await queuedAniListFetch({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "KAZEN/1.0 (+https://kazen.lovable.app)",
          },
          body: JSON.stringify({ query: gql, variables }),
        });

        if (res.status === 429 && attempt < 2) {
          const retryAfter = Number(res.headers.get("retry-after"));
          await wait(Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 1500) : 650 * (attempt + 1));
          continue;
        }

        if (!res.ok) throw new Error(`AniList ${res.status}`);

        const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
        if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));

        const value = json.data as T;
        queryCache.set(key, {
          value,
          expiresAt: Date.now() + CACHE_TTL_MS,
          staleUntil: Date.now() + STALE_TTL_MS,
          pending: queryCache.get(key)?.pending,
        });
        // Fire-and-forget: publish to the shared cache for other isolates.
        void writeSharedCache(key, value);
        return value;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await wait(450 * (attempt + 1));
      }
    }

    // Stale-if-error, in-memory first: serve ANY previously cached value rather
    // than an error screen.
    if (cached?.value) {
      console.error("AniList indisponible, cache mémoire conservé", lastError);
      return cached.value;
    }

    // Stale-if-error, shared cache: even an expired shared payload beats an
    // empty/errored anime section across a cold isolate.
    if (shared) {
      console.error("AniList indisponible, cache partagé (périmé) conservé", lastError);
      queryCache.set(key, {
        value: shared.value,
        expiresAt: 0,
        staleUntil: shared.fetchedAt + STALE_TTL_MS,
        pending: queryCache.get(key)?.pending,
      });
      return shared.value;
    }

    throw lastError instanceof Error ? lastError : new Error("AniList request failed");
  })();

  queryCache.set(key, {
    value: cached?.value,
    expiresAt: cached?.expiresAt ?? 0,
    staleUntil: cached?.staleUntil ?? 0,
    pending,
  });

  try {
    return await pending;
  } finally {
    const latest = queryCache.get(key) as CacheEntry<T> | undefined;
    if (latest?.pending === pending) {
      queryCache.set(key, {
        value: latest.value,
        expiresAt: latest.expiresAt,
        staleUntil: latest.staleUntil,
      });
    }
  }
}

interface PageResult {
  Page: {
    media: Parameters<typeof fromAniList>[0][];
    pageInfo?: { currentPage?: number; hasNextPage?: boolean };
  };
}

export async function anilistList(params: {
  sort: string;
  page?: number;
  perPage?: number;
  season?: string;
  seasonYear?: number;
  status?: string;
  search?: string;
}): Promise<MediaItem[]> {
  const gql = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int, $status: MediaStatus, $search: String) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: $sort, season: $season, seasonYear: $seasonYear, status: $status, search: $search, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }`;
  const data = await query<PageResult>(gql, {
    page: params.page ?? 1,
    perPage: params.perPage ?? 20,
    sort: [params.sort],
    season: params.season,
    seasonYear: params.seasonYear,
    status: params.status,
    search: params.search,
  });
  return (data.Page?.media ?? []).filter((m) => m && m.id != null).map(fromAniList);
}

/** Paginated AniList list with hasMore flag for "voir plus" loading. */
export async function anilistPaged(params: {
  sort: string;
  page?: number;
  perPage?: number;
  season?: string;
  seasonYear?: number;
  status?: string;
}): Promise<{ items: MediaItem[]; page: number; hasMore: boolean }> {
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 30;
  const gql = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int, $status: MediaStatus) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { currentPage hasNextPage }
        media(type: ANIME, sort: $sort, season: $season, seasonYear: $seasonYear, status: $status, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }`;
  const data = await query<PageResult>(gql, {
    page,
    perPage,
    sort: [params.sort],
    season: params.season,
    seasonYear: params.seasonYear,
    status: params.status,
  });
  return {
    items: (data.Page?.media ?? []).filter((m) => m && m.id != null).map(fromAniList),
    page,
    hasMore: Boolean(data.Page?.pageInfo?.hasNextPage),
  };
}

/** Paginated AniList search for infinite scroll on the search page. */
export async function anilistSearchPaged(
  q: string,
  page: number,
): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  const perPage = 24;
  const gql = `
    query ($page: Int, $perPage: Int, $search: String) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        media(type: ANIME, sort: SEARCH_MATCH, search: $search, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }`;
  const data = await query<PageResult>(gql, { page, perPage, search: q });
  return {
    items: (data.Page?.media ?? []).filter((m) => m && m.id != null).map(fromAniList),
    hasMore: Boolean(data.Page?.pageInfo?.hasNextPage),
  };
}



export async function anilistDetail(id: number): Promise<MediaDetail | null> {
  const gql = `query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${MEDIA_FIELDS}
      format
      popularity
      season
      seasonYear
      source
      countryOfOrigin
      isAdult
      synonyms
      endDate { year month day }
      trailer { id site }
      studios(isMain: true) { nodes { name } }
      characters(sort: [ROLE, RELEVANCE], perPage: 14) {
        edges {
          role
          node { id name { full } image { medium } }
          voiceActors(language: JAPANESE) { name { full } }
        }
      }
      staff(perPage: 10) {
        edges { role node { id name { full } image { medium } } }
      }
      relations {
        edges {
          relationType(version: 2)
          node { id type format title { romaji english } coverImage { large } }
        }
      }
    }
  }`;
  const data = await query<{
    Media: (AniListDetailRaw & Parameters<typeof fromAniList>[0]) | null;
  }>(gql, { id });
  return data.Media ? fromAniListDetail(data.Media) : null;
}

interface AniListDetailRaw {
  format?: string | null;
  popularity?: number | null;
  season?: string | null;
  seasonYear?: number | null;
  source?: string | null;
  countryOfOrigin?: string | null;
  isAdult?: boolean | null;
  synonyms?: (string | null)[] | null;
  endDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  trailer?: { id?: string | null; site?: string | null } | null;
  studios?: { nodes?: { name?: string | null }[] | null } | null;
  characters?: {
    edges?: {
      role?: string | null;
      node?: { id?: number; name?: { full?: string | null } | null; image?: { medium?: string | null } | null } | null;
      voiceActors?: { name?: { full?: string | null } | null }[] | null;
    }[] | null;
  } | null;
  staff?: {
    edges?: {
      role?: string | null;
      node?: { id?: number; name?: { full?: string | null } | null; image?: { medium?: string | null } | null } | null;
    }[] | null;
  } | null;
  relations?: {
    edges?: {
      relationType?: string | null;
      node?: {
        id?: number;
        type?: string | null;
        format?: string | null;
        title?: { romaji?: string | null; english?: string | null } | null;
        coverImage?: { large?: string | null } | null;
      } | null;
    }[] | null;
  } | null;
}

const ANILIST_FORMAT: Record<string, string> = {
  TV: "Série TV",
  TV_SHORT: "Format court",
  MOVIE: "Film",
  SPECIAL: "Spécial",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Clip",
};

const ANILIST_SEASON: Record<string, string> = {
  WINTER: "Hiver",
  SPRING: "Printemps",
  SUMMER: "Été",
  FALL: "Automne",
};

const ANILIST_RELATION: Record<string, string> = {
  SEQUEL: "Suite",
  PREQUEL: "Préquelle",
  SIDE_STORY: "Histoire parallèle",
  PARENT: "Œuvre parente",
  SPIN_OFF: "Spin-off",
  ALTERNATIVE: "Version alternative",
  SUMMARY: "Résumé",
  CHARACTER: "Personnages",
  SOURCE: "Source",
  ADAPTATION: "Adaptation",
  OTHER: "Autre",
};

const ANILIST_RELATION_CATEGORY: Record<string, import("./media-types").RelationCategory> = {
  SEQUEL: "franchise",
  PREQUEL: "franchise",
  SIDE_STORY: "franchise",
  PARENT: "franchise",
  SPIN_OFF: "franchise",
  ALTERNATIVE: "franchise",
  SUMMARY: "franchise",
  SOURCE: "adaptation",
  ADAPTATION: "adaptation",
  CHARACTER: "other",
  OTHER: "other",
};

const ANILIST_SOURCE: Record<string, string> = {
  ORIGINAL: "Œuvre originale",
  MANGA: "Manga",
  LIGHT_NOVEL: "Light novel",
  VISUAL_NOVEL: "Visual novel",
  VIDEO_GAME: "Jeu vidéo",
  NOVEL: "Roman",
  DOUJINSHI: "Dōjinshi",
  ANIME: "Anime",
  WEB_NOVEL: "Web novel",
  LIVE_ACTION: "Live action",
  GAME: "Jeu",
  COMIC: "Comic",
  MULTIMEDIA_PROJECT: "Projet multimédia",
  PICTURE_BOOK: "Livre illustré",
  OTHER: "Autre",
};

const COUNTRY_LABELS: Record<string, string> = {
  JP: "Japon",
  CN: "Chine",
  KR: "Corée du Sud",
  TW: "Taïwan",
  US: "États-Unis",
  FR: "France",
  GB: "Royaume-Uni",
};

function anilistDate(d?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  if (!d?.year) return null;
  const mm = String(d.month ?? 1).padStart(2, "0");
  const dd = String(d.day ?? 1).padStart(2, "0");
  return `${d.year}-${mm}-${dd}`;
}

function fromAniListDetail(m: AniListDetailRaw & Parameters<typeof fromAniList>[0]): MediaDetail {
  const bmedia = fromAniList(m);
  const trailerUrl =
    m.trailer?.site === "youtube" && m.trailer.id
      ? `https://www.youtube.com/embed/${m.trailer.id}`
      : null;
  const cast: CreditPerson[] = (m.characters?.edges ?? []).map((e) => ({
    id: `c${e.node?.id ?? Math.random()}`,
    name: e.node?.name?.full ?? "—",
    role: e.voiceActors?.[0]?.name?.full ?? e.role ?? null,
    photoUrl: e.node?.image?.medium ?? null,
  }));
  const crew: CreditPerson[] = (m.staff?.edges ?? []).map((e) => ({
    id: `s${e.node?.id ?? Math.random()}`,
    name: e.node?.name?.full ?? "—",
    role: e.role ?? null,
    photoUrl: e.node?.image?.medium ?? null,
  }));
  const related: RelatedMedia[] = (m.relations?.edges ?? [])
    .filter((e) => e.node?.type === "ANIME" && e.node?.id)
    .map((e) => ({
      key: `anilist:${e.node!.id}`,
      source: "anilist" as const,
      externalId: String(e.node!.id),
      title: e.node!.title?.english || e.node!.title?.romaji || "Sans titre",
      posterUrl: e.node!.coverImage?.large ?? null,
      relation: ANILIST_RELATION[e.relationType ?? "OTHER"] ?? "Lié",
      relationCategory: ANILIST_RELATION_CATEGORY[e.relationType ?? "OTHER"] ?? "other",
      mediaType: "anime" as const,
      format: e.node!.format ? ANILIST_FORMAT[e.node!.format] ?? e.node!.format : null,
    }));
  const alt = Array.from(
    new Set(
      [m.title?.native, ...(m.synonyms ?? [])]
        .map((s) => (s ?? "").trim())
        .filter((s) => s && s !== bmedia.title && s !== bmedia.titleOriginal),
    ),
  ).slice(0, 6);
  return {
    ...bmedia,
    trailerUrl,
    format: m.format ? ANILIST_FORMAT[m.format] ?? m.format : null,
    seasonLabel:
      m.season && m.seasonYear ? `${ANILIST_SEASON[m.season] ?? m.season} ${m.seasonYear}` : null,
    studios: (m.studios?.nodes ?? []).map((n) => n.name ?? "").filter(Boolean),
    popularity: m.popularity ?? null,
    castLabel: "Personnages & voix",
    cast,
    crewLabel: "Équipe",
    crew,
    related,
    collectionName: null,
    titleAlternatives: alt,
    originSource: m.source ? ANILIST_SOURCE[m.source] ?? null : null,
    ageRating: m.isAdult ? "18+" : null,
    countryOfOrigin: m.countryOfOrigin
      ? COUNTRY_LABELS[m.countryOfOrigin] ?? m.countryOfOrigin
      : null,
    endDate: anilistDate(m.endDate),
    videos: trailerUrl
      ? [{ key: m.trailer!.id!, label: "Bande-annonce", url: trailerUrl }]
      : [],
  };
}

export function currentAnimeSeason(date = new Date()): { season: string; year: number } {
  const m = date.getMonth();
  const season = m < 3 ? "WINTER" : m < 6 ? "SPRING" : m < 9 ? "SUMMER" : "FALL";
  return { season, year: date.getFullYear() };
}
