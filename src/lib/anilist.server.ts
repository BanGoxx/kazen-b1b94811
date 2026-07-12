// Server-only AniList GraphQL access. AniList is a public keyless GraphQL API.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fromAniList } from "./normalize";
import { orderEpisodes, parseStreamingTitle } from "./episodes";
import type {
  CreditPerson,
  EntityMediaLink,
  EntityProfile,
  EntityRelatedPerson,
  MediaDetail,
  MediaEpisode,
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
  streamingEpisodes { title thumbnail url site }
  airingSchedule(perPage: 100, notYetAired: false) { nodes { episode airingAt } }
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
            // AniList sits behind Cloudflare bot-protection that returns 403 to
            // requests carrying a non-browser User-Agent (our old "KAZEN/1.0"
            // token was blocked from Cloudflare Workers in production). A
            // realistic browser UA + Origin/Referer clears the challenge.
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Origin: "https://anilist.co",
            Referer: "https://anilist.co/",
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
          node { id type format title { romaji english } coverImage { large } startDate { year } }
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
  streamingEpisodes?: {
    title?: string | null;
    thumbnail?: string | null;
    url?: string | null;
    site?: string | null;
  }[] | null;
  airingSchedule?: {
    nodes?: { episode?: number | null; airingAt?: number | null }[] | null;
  } | null;
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
        startDate?: { year?: number | null } | null;
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
  MANGA: "Manga",
  NOVEL: "Light novel",
  ONE_SHOT: "One shot",
};

// Classify an AniList node into a coarse format family for group pages.
function anilistFormatGroup(
  type?: string | null,
  format?: string | null,
): import("./media-types").FormatGroup {
  if (format === "MUSIC") return "music";
  if (format === "NOVEL") return "novel";
  if (format === "MANGA" || format === "ONE_SHOT") return "manga";
  if (type === "MANGA") return format === "NOVEL" ? "novel" : "manga";
  if (type === "ANIME") return "anime";
  return "other";
}

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
    .filter((e) => (e.node?.type === "ANIME" || e.node?.type === "MANGA") && e.node?.id)
    .map((e) => {
      const isAnime = e.node!.type === "ANIME";
      return {
        key: `anilist:${e.node!.id}`,
        source: "anilist" as const,
        externalId: String(e.node!.id),
        title: e.node!.title?.english || e.node!.title?.romaji || "Sans titre",
        posterUrl: e.node!.coverImage?.large ?? null,
        relation: ANILIST_RELATION[e.relationType ?? "OTHER"] ?? "Lié",
        relationCategory: ANILIST_RELATION_CATEGORY[e.relationType ?? "OTHER"] ?? "other",
        mediaType: "anime" as const,
        format: e.node!.format ? ANILIST_FORMAT[e.node!.format] ?? e.node!.format : null,
        formatGroup: anilistFormatGroup(e.node!.type, e.node!.format),
        year: e.node!.startDate?.year ?? null,
        hasDetail: isAnime,
      };
    });
  const alt = Array.from(
    new Set(
      [m.title?.native, ...(m.synonyms ?? [])]
        .map((s) => (s ?? "").trim())
        .filter((s) => s && s !== bmedia.title && s !== bmedia.titleOriginal),
    ),
  ).slice(0, 6);

  // Merge streamingEpisodes (titles/thumbnails) with airingSchedule (dates)
  // by episode number to build a coherent episode list.
  const scheduleByEp = new Map<number, number>();
  for (const n of m.airingSchedule?.nodes ?? []) {
    if (typeof n.episode === "number" && typeof n.airingAt === "number") {
      scheduleByEp.set(n.episode, n.airingAt);
    }
  }
  const episodes: MediaEpisode[] = (m.streamingEpisodes ?? []).map((se, idx) => {
    const parsed = parseStreamingTitle(se.title);
    const number = parsed.number ?? idx + 1;
    const airingAt = scheduleByEp.get(number);
    const airDate = airingAt ? new Date(airingAt * 1000).toISOString() : null;
    return {
      number,
      title: parsed.title,
      airDate,
      thumbnailUrl: se.thumbnail ?? null,
      isAired: airDate ? new Date(airDate).getTime() <= Date.now() : true,
    };
  });
  // If we only have a schedule (no streaming titles), still expose aired episodes.
  if (episodes.length === 0 && scheduleByEp.size > 0) {
    for (const [number, airingAt] of scheduleByEp) {
      const airDate = new Date(airingAt * 1000).toISOString();
      episodes.push({
        number,
        title: null,
        airDate,
        thumbnailUrl: null,
        isAired: new Date(airDate).getTime() <= Date.now(),
      });
    }
  }
  const orderedEpisodes = orderEpisodes(episodes);

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
    episodes: orderedEpisodes,
  };
}

export function currentAnimeSeason(date = new Date()): { season: string; year: number } {
  const m = date.getMonth();
  const season = m < 3 ? "WINTER" : m < 6 ? "SPRING" : m < 9 ? "SUMMER" : "FALL";
  return { season, year: date.getFullYear() };
}

// ---------- Dedicated entity profiles (characters & staff) ----------
//
// Real KAZEN entity pages backed by AniList. Progressive by design: the route
// serves a full page when a profile is found, and falls back to the lightweight
// overlay when the id is not a real AniList node. Descriptions arrive in the
// source language (usually English) — we sanitize them to clean plain text so a
// French-normalized summary can be swapped in later without touching the UI.

/** Strip AniList's markdown/HTML/spoiler markup down to readable plain text. */
function cleanEntityDescription(d?: string | null): string | null {
  if (!d) return null;
  const s = d
    .replace(/~!.*?!~/gs, "") // spoiler blocks
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // markdown links
    .replace(/_{1,3}(.+?)_{1,3}/g, "$1")
    .replace(/\*{1,3}(.+?)\*{1,3}/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s.length ? s : null;
}

const CHARACTER_ROLE_LABELS: Record<string, string> = {
  MAIN: "Rôle principal",
  SUPPORTING: "Rôle secondaire",
  BACKGROUND: "Figuration",
};

function entityDate(d?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  if (!d) return null;
  if (d.day && d.month) {
    const mm = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][d.month - 1] ?? "";
    return `${d.day} ${mm}${d.year ? ` ${d.year}` : ""}`.trim();
  }
  if (d.year) return String(d.year);
  return null;
}

function mediaTitle(t?: { romaji?: string | null; english?: string | null } | null): string {
  return t?.english || t?.romaji || "Sans titre";
}

interface CharacterRaw {
  id?: number;
  name?: { full?: string | null; native?: string | null } | null;
  image?: { large?: string | null } | null;
  description?: string | null;
  gender?: string | null;
  age?: string | null;
  dateOfBirth?: { year?: number | null; month?: number | null; day?: number | null } | null;
  media?: {
    edges?: {
      characterRole?: string | null;
      voiceActors?: { id?: number; name?: { full?: string | null } | null; image?: { medium?: string | null } | null }[] | null;
      node?: { id?: number; type?: string | null; format?: string | null; title?: { romaji?: string | null; english?: string | null } | null; coverImage?: { large?: string | null } | null; startDate?: { year?: number | null } | null } | null;
    }[] | null;
  } | null;
}

export async function anilistCharacter(id: number): Promise<EntityProfile | null> {
  const gql = `query ($id: Int) {
    Character(id: $id) {
      id
      name { full native }
      image { large }
      description(asHtml: false)
      gender
      age
      dateOfBirth { year month day }
      media(sort: POPULARITY_DESC, perPage: 16) {
        edges {
          characterRole
          voiceActors(language: JAPANESE, sort: RELEVANCE) { id name { full } image { medium } }
          node { id type format title { romaji english } coverImage { large } startDate { year } }
        }
      }
    }
  }`;
  const data = await query<{ Character: CharacterRaw | null }>(gql, { id });
  const c = data.Character;
  if (!c?.id || !c.name?.full) return null;

  const facts: { label: string; value: string }[] = [];
  if (c.gender) facts.push({ label: "Genre", value: c.gender === "Male" ? "Masculin" : c.gender === "Female" ? "Féminin" : c.gender });
  if (c.age) facts.push({ label: "Âge", value: c.age });
  const bday = entityDate(c.dateOfBirth);
  if (bday) facts.push({ label: "Anniversaire", value: bday });

  const edges = c.media?.edges ?? [];
  const media: EntityMediaLink[] = edges
    .filter((e) => e.node?.id)
    .map((e) => ({
      id: String(e.node!.id),
      title: mediaTitle(e.node!.title),
      posterUrl: e.node!.coverImage?.large ?? null,
      role: e.characterRole ? CHARACTER_ROLE_LABELS[e.characterRole] ?? null : null,
      format: e.node!.format ? ANILIST_FORMAT[e.node!.format] ?? e.node!.format : null,
      year: e.node!.startDate?.year ?? null,
      hasDetail: e.node!.type === "ANIME",
    }));

  // Voice actors across the character's roles, de-duplicated.
  const vaMap = new Map<number, EntityRelatedPerson>();
  for (const e of edges) {
    for (const va of e.voiceActors ?? []) {
      if (va?.id && !vaMap.has(va.id)) {
        vaMap.set(va.id, {
          id: `s${va.id}`,
          kind: "staff",
          name: va.name?.full ?? "—",
          photoUrl: va.image?.medium ?? null,
          role: "Voix (JP)",
        });
      }
    }
  }

  return {
    kind: "character",
    id: String(c.id),
    name: c.name.full,
    nameNative: c.name.native ?? null,
    photoUrl: c.image?.large ?? null,
    description: cleanEntityDescription(c.description),
    facts,
    media,
    peopleLabel: "Voix japonaises",
    people: Array.from(vaMap.values()).slice(0, 12),
    anilistUrl: `https://anilist.co/character/${c.id}`,
  };
}

interface StaffRaw {
  id?: number;
  name?: { full?: string | null; native?: string | null } | null;
  image?: { large?: string | null } | null;
  description?: string | null;
  primaryOccupations?: (string | null)[] | null;
  gender?: string | null;
  homeTown?: string | null;
  dateOfBirth?: { year?: number | null; month?: number | null; day?: number | null } | null;
  staffMedia?: {
    edges?: {
      staffRole?: string | null;
      node?: { id?: number; type?: string | null; format?: string | null; title?: { romaji?: string | null; english?: string | null } | null; coverImage?: { large?: string | null } | null; startDate?: { year?: number | null } | null } | null;
    }[] | null;
  } | null;
  characters?: {
    nodes?: { id?: number; name?: { full?: string | null } | null; image?: { medium?: string | null } | null }[] | null;
  } | null;
}

export async function anilistStaff(id: number): Promise<EntityProfile | null> {
  const gql = `query ($id: Int) {
    Staff(id: $id) {
      id
      name { full native }
      image { large }
      description(asHtml: false)
      primaryOccupations
      gender
      homeTown
      dateOfBirth { year month day }
      staffMedia(sort: POPULARITY_DESC, perPage: 16) {
        edges {
          staffRole
          node { id type format title { romaji english } coverImage { large } startDate { year } }
        }
      }
      characters(sort: FAVOURITES_DESC, perPage: 12) {
        nodes { id name { full } image { medium } }
      }
    }
  }`;
  const data = await query<{ Staff: StaffRaw | null }>(gql, { id });
  const s = data.Staff;
  if (!s?.id || !s.name?.full) return null;

  const facts: { label: string; value: string }[] = [];
  const occ = (s.primaryOccupations ?? []).map((o) => (o ?? "").trim()).filter(Boolean);
  if (occ.length) facts.push({ label: "Métiers", value: occ.slice(0, 3).join(" · ") });
  if (s.gender) facts.push({ label: "Genre", value: s.gender === "Male" ? "Masculin" : s.gender === "Female" ? "Féminin" : s.gender });
  if (s.homeTown) facts.push({ label: "Origine", value: s.homeTown });
  const bday = entityDate(s.dateOfBirth);
  if (bday) facts.push({ label: "Naissance", value: bday });

  // De-duplicate works (staff are often credited multiple times per title).
  const mediaMap = new Map<number, EntityMediaLink>();
  for (const e of s.staffMedia?.edges ?? []) {
    const n = e.node;
    if (!n?.id) continue;
    const existing = mediaMap.get(n.id);
    if (existing) {
      if (e.staffRole && existing.role && !existing.role.includes(e.staffRole)) {
        existing.role = `${existing.role}, ${e.staffRole}`;
      }
      continue;
    }
    mediaMap.set(n.id, {
      id: String(n.id),
      title: mediaTitle(n.title),
      posterUrl: n.coverImage?.large ?? null,
      role: e.staffRole ?? null,
      format: n.format ? ANILIST_FORMAT[n.format] ?? n.format : null,
      year: n.startDate?.year ?? null,
      hasDetail: n.type === "ANIME",
    });
  }

  const people: EntityRelatedPerson[] = (s.characters?.nodes ?? [])
    .filter((n) => n?.id)
    .map((n) => ({
      id: `c${n!.id}`,
      kind: "character" as const,
      name: n!.name?.full ?? "—",
      photoUrl: n!.image?.medium ?? null,
      role: null,
    }));

  return {
    kind: "staff",
    id: String(s.id),
    name: s.name.full,
    nameNative: s.name.native ?? null,
    photoUrl: s.image?.large ?? null,
    description: cleanEntityDescription(s.description),
    facts,
    media: Array.from(mediaMap.values()),
    peopleLabel: "Personnages notables",
    people,
    anilistUrl: `https://anilist.co/staff/${s.id}`,
  };
}
