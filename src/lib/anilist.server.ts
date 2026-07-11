// Server-only AniList GraphQL access. AniList is a public keyless GraphQL API.
import { fromAniList } from "./normalize";
import type {
  CreditPerson,
  MediaDetail,
  MediaItem,
  RelatedMedia,
} from "./media-types";

const ENDPOINT = "https://graphql.anilist.co";

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
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: gql, variables }),
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data as T;
}

interface PageResult {
  Page: { media: Parameters<typeof fromAniList>[0][] };
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
  return (data.Page?.media ?? []).map(fromAniList);
}

export async function anilistDetail(id: number): Promise<MediaDetail | null> {
  const gql = `query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${MEDIA_FIELDS}
      format
      popularity
      season
      seasonYear
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
  const data = await query<{ Media: AniListDetailRaw | null }>(gql, { id });
  return data.Media ? fromAniListDetail(data.Media) : null;
}

interface AniListDetailRaw {
  format?: string | null;
  popularity?: number | null;
  season?: string | null;
  seasonYear?: number | null;
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
      mediaType: "anime" as const,
    }));
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
  };
}

export function currentAnimeSeason(date = new Date()): { season: string; year: number } {
  const m = date.getMonth();
  const season = m < 3 ? "WINTER" : m < 6 ? "SPRING" : m < 9 ? "SUMMER" : "FALL";
  return { season, year: date.getFullYear() };
}
