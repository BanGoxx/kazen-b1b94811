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
import { dedupePlatforms, resolvePlatform } from "./platforms";

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
  streamingEpisodes { title thumbnail url site }
  airingSchedule(perPage: 100, notYetAired: false) { nodes { episode airingAt } }
  externalLinks { site url type }
`;

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
  streamingEpisodes?: {
    title?: string | null;
    thumbnail?: string | null;
    url?: string | null;
    site?: string | null;
  }[] | null;
  airingSchedule?: {
    nodes?: { episode?: number | null; airingAt?: number | null }[] | null;
  } | null;
  externalLinks?: { site?: string | null; url?: string | null; type?: string | null }[] | null;
}

interface AniListDetailRaw extends AniListMedia {
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

interface PageResult {
  Page: {
    media: AniListMedia[];
    pageInfo?: { currentPage?: number; hasNextPage?: boolean };
  };
}

const ANILIST_GENRES: Record<string, string> = {
  Action: "Action",
  Adventure: "Aventure",
  Comedy: "Comédie",
  Drama: "Drame",
  Ecchi: "Ecchi",
  Fantasy: "Fantastique",
  Horror: "Horreur",
  "Mahou Shoujo": "Magical Girl",
  Mecha: "Mecha",
  Music: "Musique",
  Mystery: "Mystère",
  Psychological: "Psychologique",
  Romance: "Romance",
  "Sci-Fi": "Science-Fiction",
  "Slice of Life": "Tranche de vie",
  Sports: "Sport",
  Supernatural: "Surnaturel",
  Thriller: "Thriller",
};

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

const CHARACTER_ROLE_LABELS: Record<string, string> = {
  MAIN: "Rôle principal",
  SUPPORTING: "Rôle secondaire",
  BACKGROUND: "Figuration",
};

function stripMarkup(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = input
    .replace(/~!.*?!~/gs, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/_{1,3}(.+?)_{1,3}/g, "$1")
    .replace(/\*{1,3}(.+?)\*{1,3}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function aniListDate(d?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  if (!d?.year) return null;
  const month = String(d.month ?? 1).padStart(2, "0");
  const day = String(d.day ?? 1).padStart(2, "0");
  return `${d.year}-${month}-${day}`;
}

function entityDate(d?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  if (!d) return null;
  if (d.day && d.month) {
    const month = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][d.month - 1] ?? "";
    return `${d.day} ${month}${d.year ? ` ${d.year}` : ""}`.trim();
  }
  return d.year ? String(d.year) : null;
}

function aniListStatus(status?: string | null): MediaItem["status"] {
  if (status === "NOT_YET_RELEASED") return "a_venir";
  if (status === "RELEASING") return "en_cours";
  if (status === "FINISHED") return "termine";
  return null;
}

function anilistFormatGroup(type?: string | null, format?: string | null): RelatedMedia["formatGroup"] {
  if (format === "MUSIC") return "music";
  if (format === "NOVEL") return "novel";
  if (format === "MANGA" || format === "ONE_SHOT") return "manga";
  if (type === "MANGA") return format === "NOVEL" ? "novel" : "manga";
  if (type === "ANIME") return "anime";
  return "other";
}

function relationCategory(relation?: string | null): RelatedMedia["relationCategory"] {
  switch (relation) {
    case "SEQUEL":
    case "PREQUEL":
    case "SIDE_STORY":
    case "PARENT":
    case "SPIN_OFF":
    case "ALTERNATIVE":
    case "SUMMARY":
      return "franchise";
    case "SOURCE":
    case "ADAPTATION":
      return "adaptation";
    default:
      return "other";
  }
}

async function query<T>(gql: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: gql, variables }),
  });
  if (!res.ok) throw new Error(`AniList public ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data as T;
}

function fromAniList(m: AniListMedia): MediaItem {
  const platforms = (m.externalLinks ?? [])
    .map((link) => (link?.site ? resolvePlatform(link.site, null, "stream", link.url ?? null) : null))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return {
    key: `anilist:${m.id}`,
    source: "anilist",
    externalId: String(m.id),
    mediaType: "anime",
    title: m.title?.english || m.title?.romaji || m.title?.native || "Sans titre",
    titleOriginal: m.title?.native || m.title?.romaji || null,
    synopsis: stripMarkup(m.description),
    posterUrl: m.coverImage?.extraLarge || m.coverImage?.large || null,
    backdropUrl: m.bannerImage || null,
    genres: (m.genres ?? []).map((g) => ANILIST_GENRES[g] ?? g),
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

function fromAniListDetail(m: AniListDetailRaw): MediaDetail {
  const base = fromAniList(m);
  const trailerUrl =
    m.trailer?.site === "youtube" && m.trailer.id
      ? `https://www.youtube.com/embed/${m.trailer.id}`
      : null;

  const cast: CreditPerson[] = (m.characters?.edges ?? []).map((edge) => ({
    id: `c${edge.node?.id ?? Math.random()}`,
    name: edge.node?.name?.full ?? "—",
    role: edge.voiceActors?.[0]?.name?.full ?? edge.role ?? null,
    photoUrl: edge.node?.image?.medium ?? null,
  }));

  const crew: CreditPerson[] = (m.staff?.edges ?? []).map((edge) => ({
    id: `s${edge.node?.id ?? Math.random()}`,
    name: edge.node?.name?.full ?? "—",
    role: edge.role ?? null,
    photoUrl: edge.node?.image?.medium ?? null,
  }));

  const related: RelatedMedia[] = (m.relations?.edges ?? [])
    .filter((edge) => (edge.node?.type === "ANIME" || edge.node?.type === "MANGA") && edge.node?.id)
    .map((edge) => {
      const node = edge.node!;
      const isAnime = node.type === "ANIME";
      return {
        key: `anilist:${node.id}`,
        source: "anilist" as const,
        externalId: String(node.id),
        title: node.title?.english || node.title?.romaji || "Sans titre",
        posterUrl: node.coverImage?.large ?? null,
        relation: ANILIST_RELATION[edge.relationType ?? "OTHER"] ?? "Lié",
        relationCategory: relationCategory(edge.relationType),
        mediaType: "anime" as const,
        format: node.format ? ANILIST_FORMAT[node.format] ?? node.format : null,
        formatGroup: anilistFormatGroup(node.type, node.format),
        year: node.startDate?.year ?? null,
        hasDetail: isAnime,
      };
    });

  const scheduleByEp = new Map<number, number>();
  for (const node of m.airingSchedule?.nodes ?? []) {
    if (typeof node.episode === "number" && typeof node.airingAt === "number") {
      scheduleByEp.set(node.episode, node.airingAt);
    }
  }
  const episodes: MediaEpisode[] = (m.streamingEpisodes ?? []).map((episode, index) => {
    const parsed = parseStreamingTitle(episode.title);
    const number = parsed.number ?? index + 1;
    const airingAt = scheduleByEp.get(number);
    const airDate = airingAt ? new Date(airingAt * 1000).toISOString() : null;
    return {
      number,
      title: parsed.title,
      airDate,
      thumbnailUrl: episode.thumbnail ?? null,
      isAired: airDate ? new Date(airDate).getTime() <= Date.now() : true,
    };
  });
  if (!episodes.length && scheduleByEp.size) {
    for (const [number, airingAt] of scheduleByEp) {
      const airDate = new Date(airingAt * 1000).toISOString();
      episodes.push({ number, title: null, airDate, thumbnailUrl: null, isAired: new Date(airDate).getTime() <= Date.now() });
    }
  }

  const alternatives = Array.from(
    new Set(
      [m.title?.native, ...(m.synonyms ?? [])]
        .map((value) => (value ?? "").trim())
        .filter((value) => value && value !== base.title && value !== base.titleOriginal),
    ),
  ).slice(0, 6);

  return {
    ...base,
    trailerUrl,
    format: m.format ? ANILIST_FORMAT[m.format] ?? m.format : null,
    seasonLabel: m.season && m.seasonYear ? `${ANILIST_SEASON[m.season] ?? m.season} ${m.seasonYear}` : null,
    studios: (m.studios?.nodes ?? []).map((node) => node.name ?? "").filter(Boolean),
    popularity: m.popularity ?? null,
    castLabel: "Personnages & voix",
    cast,
    crewLabel: "Équipe",
    crew,
    related,
    collectionName: null,
    titleAlternatives: alternatives,
    originSource: m.source ? ANILIST_SOURCE[m.source] ?? null : null,
    ageRating: m.isAdult ? "18+" : null,
    countryOfOrigin: m.countryOfOrigin ? COUNTRY_LABELS[m.countryOfOrigin] ?? m.countryOfOrigin : null,
    endDate: aniListDate(m.endDate),
    videos: trailerUrl ? [{ key: m.trailer!.id!, label: "Bande-annonce", url: trailerUrl }] : [],
    episodes: orderEpisodes(episodes),
  };
}

export async function anilistPublicDetail(id: number): Promise<MediaDetail | null> {
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
      characters(sort: [ROLE, RELEVANCE], perPage: 24) {
        edges {
          role
          node { id name { full } image { medium } }
          voiceActors(language: JAPANESE) { name { full } }
        }
      }
      staff(perPage: 16) {
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
  const data = await query<{ Media: AniListDetailRaw | null }>(gql, { id });
  return data.Media ? fromAniListDetail(data.Media) : null;
}

export async function anilistPublicPage(kind: string, page: number): Promise<{ items: MediaItem[]; page: number; hasMore: boolean }> {
  const cfg =
    kind === "popular"
      ? { sort: "POPULARITY_DESC" }
      : kind === "upcoming"
        ? { sort: "POPULARITY_DESC", status: "NOT_YET_RELEASED" }
        : { sort: "TRENDING_DESC" };
  const gql = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { currentPage hasNextPage }
        media(type: ANIME, sort: $sort, status: $status, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }`;
  const data = await query<PageResult>(gql, {
    page,
    perPage: 30,
    sort: [cfg.sort],
    status: "status" in cfg ? cfg.status : undefined,
  });
  return {
    items: (data.Page?.media ?? []).filter((media) => media && media.id != null).map(fromAniList),
    page,
    hasMore: Boolean(data.Page?.pageInfo?.hasNextPage),
  };
}

/**
 * Browser-direct fetch for the homepage anime rails (trending / popular /
 * upcoming). Mirrors the server list handlers so that when the production
 * Worker is 403-blocked by AniList, the browser CORS path still delivers the
 * real, complete list instead of the curated fallback.
 */
export async function anilistPublicList(kind: string): Promise<MediaItem[]> {
  const { items } = await anilistPublicPage(kind, 1);
  return items;
}

const CLIENT_SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;
const CLIENT_SEASON_LABELS: Record<string, string> = {
  WINTER: "Hiver",
  SPRING: "Printemps",
  SUMMER: "Été",
  FALL: "Automne",
};

/** Client-safe current anime season (AniList seasons are 3-month blocks). */
function clientCurrentSeason(): { season: string; year: number } {
  const now = new Date();
  const season = CLIENT_SEASONS[Math.floor(now.getMonth() / 3)];
  return { season, year: now.getFullYear() };
}

/** Browser-direct seasonal anime fetch matching getSeasonalAnime's shape. */
export async function anilistPublicSeasonal(
  season?: string,
  year?: number,
): Promise<{ items: MediaItem[]; season: string; year: number; label: string }> {
  const fallback = clientCurrentSeason();
  const s = season ?? fallback.season;
  const y = year ?? fallback.year;
  const gql = `
    query ($season: MediaSeason, $seasonYear: Int, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }`;
  const data = await query<PageResult>(gql, { season: s, seasonYear: y, perPage: 50 });
  return {
    items: (data.Page?.media ?? []).filter((media) => media && media.id != null).map(fromAniList),
    season: s,
    year: y,
    label: CLIENT_SEASON_LABELS[s] ?? s,
  };
}

export async function anilistPublicSearchPaged(q: string, page: number): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  const gql = `
    query ($page: Int, $perPage: Int, $search: String) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        media(type: ANIME, sort: SEARCH_MATCH, search: $search, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }`;
  const data = await query<PageResult>(gql, { page, perPage: 24, search: q });
  return {
    items: (data.Page?.media ?? []).filter((media) => media && media.id != null).map(fromAniList),
    hasMore: Boolean(data.Page?.pageInfo?.hasNextPage),
  };
}

function mediaTitle(title?: { romaji?: string | null; english?: string | null } | null): string {
  return title?.english || title?.romaji || "Sans titre";
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

export async function anilistPublicCharacter(id: number): Promise<EntityProfile | null> {
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
  const character = data.Character;
  if (!character?.id || !character.name?.full) return null;

  const facts: { label: string; value: string }[] = [];
  if (character.gender) facts.push({ label: "Genre", value: character.gender === "Male" ? "Masculin" : character.gender === "Female" ? "Féminin" : character.gender });
  if (character.age) facts.push({ label: "Âge", value: character.age });
  const birthday = entityDate(character.dateOfBirth);
  if (birthday) facts.push({ label: "Anniversaire", value: birthday });

  const media: EntityMediaLink[] = (character.media?.edges ?? [])
    .filter((edge) => edge.node?.id)
    .map((edge) => ({
      id: String(edge.node!.id),
      title: mediaTitle(edge.node!.title),
      posterUrl: edge.node!.coverImage?.large ?? null,
      role: edge.characterRole ? CHARACTER_ROLE_LABELS[edge.characterRole] ?? null : null,
      format: edge.node!.format ? ANILIST_FORMAT[edge.node!.format] ?? edge.node!.format : null,
      year: edge.node!.startDate?.year ?? null,
      hasDetail: edge.node!.type === "ANIME",
    }));

  const peopleMap = new Map<number, EntityRelatedPerson>();
  for (const edge of character.media?.edges ?? []) {
    for (const actor of edge.voiceActors ?? []) {
      if (actor?.id && !peopleMap.has(actor.id)) {
        peopleMap.set(actor.id, {
          id: `s${actor.id}`,
          kind: "staff",
          name: actor.name?.full ?? "—",
          photoUrl: actor.image?.medium ?? null,
          role: "Voix (JP)",
        });
      }
    }
  }

  return {
    kind: "character",
    id: String(character.id),
    name: character.name.full,
    nameNative: character.name.native ?? null,
    photoUrl: character.image?.large ?? null,
    description: stripMarkup(character.description),
    facts,
    media,
    peopleLabel: "Voix japonaises",
    people: Array.from(peopleMap.values()).slice(0, 12),
    anilistUrl: `https://anilist.co/character/${character.id}`,
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

export async function anilistPublicStaff(id: number): Promise<EntityProfile | null> {
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
  const staff = data.Staff;
  if (!staff?.id || !staff.name?.full) return null;

  const facts: { label: string; value: string }[] = [];
  const occupations = (staff.primaryOccupations ?? []).map((occupation) => (occupation ?? "").trim()).filter(Boolean);
  if (occupations.length) facts.push({ label: "Métiers", value: occupations.slice(0, 3).join(" · ") });
  if (staff.gender) facts.push({ label: "Genre", value: staff.gender === "Male" ? "Masculin" : staff.gender === "Female" ? "Féminin" : staff.gender });
  if (staff.homeTown) facts.push({ label: "Origine", value: staff.homeTown });
  const birthday = entityDate(staff.dateOfBirth);
  if (birthday) facts.push({ label: "Naissance", value: birthday });

  const mediaMap = new Map<number, EntityMediaLink>();
  for (const edge of staff.staffMedia?.edges ?? []) {
    const node = edge.node;
    if (!node?.id) continue;
    const existing = mediaMap.get(node.id);
    if (existing) {
      if (edge.staffRole && existing.role && !existing.role.includes(edge.staffRole)) {
        existing.role = `${existing.role}, ${edge.staffRole}`;
      }
      continue;
    }
    mediaMap.set(node.id, {
      id: String(node.id),
      title: mediaTitle(node.title),
      posterUrl: node.coverImage?.large ?? null,
      role: edge.staffRole ?? null,
      format: node.format ? ANILIST_FORMAT[node.format] ?? node.format : null,
      year: node.startDate?.year ?? null,
      hasDetail: node.type === "ANIME",
    });
  }

  const people: EntityRelatedPerson[] = (staff.characters?.nodes ?? [])
    .filter((node) => node?.id)
    .map((node) => ({
      id: `c${node!.id}`,
      kind: "character" as const,
      name: node!.name?.full ?? "—",
      photoUrl: node!.image?.medium ?? null,
      role: null,
    }));

  return {
    kind: "staff",
    id: String(staff.id),
    name: staff.name.full,
    nameNative: staff.name.native ?? null,
    photoUrl: staff.image?.large ?? null,
    description: stripMarkup(staff.description),
    facts,
    media: Array.from(mediaMap.values()),
    peopleLabel: "Personnages notables",
    people,
    anilistUrl: `https://anilist.co/staff/${staff.id}`,
  };
}