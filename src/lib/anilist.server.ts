// Server-only AniList GraphQL access. AniList is a public keyless GraphQL API.
import { fromAniList } from "./normalize";
import type { MediaItem } from "./media-types";

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

export async function anilistDetail(id: number): Promise<MediaItem | null> {
  const gql = `query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`;
  const data = await query<{ Media: Parameters<typeof fromAniList>[0] | null }>(gql, { id });
  return data.Media ? fromAniList(data.Media) : null;
}

export function currentAnimeSeason(date = new Date()): { season: string; year: number } {
  const m = date.getMonth();
  const season = m < 3 ? "WINTER" : m < 6 ? "SPRING" : m < 9 ? "SUMMER" : "FALL";
  return { season, year: date.getFullYear() };
}
