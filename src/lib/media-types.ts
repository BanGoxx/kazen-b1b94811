// Unified media model consumed by the whole UI. External sources (AniList, TMDB)
// are normalized into MediaItem so components never depend on a raw payload.

export type MediaSource = "anilist" | "tmdb_tv" | "tmdb_movie";
export type MediaType = "anime" | "series" | "movie";
export type MediaStatus = "a_venir" | "en_cours" | "termine";

export type WatchStatus =
  | "a_voir"
  | "en_cours"
  | "termine"
  | "en_pause"
  | "abandonne";

export type PriorityLevel = "basse" | "normale" | "haute";

export interface Platform {
  id: string;
  name: string;
  logoUrl: string | null;
  color: string;
  type: "stream" | "buy" | "rent";
  /** Deep link or provider homepage when known, for external redirection. */
  url: string | null;
}

export interface MediaItem {
  /** Stable composite reference, e.g. "anilist:12345". */
  key: string;
  source: MediaSource;
  externalId: string;
  mediaType: MediaType;
  title: string;
  titleOriginal: string | null;
  synopsis: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  /** Normalized 0-100. UI displays /10. */
  score: number | null;
  status: MediaStatus | null;
  releaseDate: string | null;
  nextEpisode: { number: number; airDate: string } | null;
  episodesCount: number | null;
  seasonsCount: number | null;
  runtime: number | null;
  platforms: Platform[];
}

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  anime: "Anime",
  series: "Série",
  movie: "Film",
};

export const STATUS_LABELS: Record<MediaStatus, string> = {
  a_venir: "À venir",
  en_cours: "En cours",
  termine: "Terminé",
};

export const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  a_voir: "À voir",
  en_cours: "En cours",
  termine: "Terminé",
  en_pause: "En pause",
  abandonne: "Abandonné",
};

export function parseMediaKey(key: string): { source: MediaSource; externalId: string } {
  const [source, externalId] = key.split(":");
  return { source: source as MediaSource, externalId };
}

// ---------- Rich detail model (detail pages) ----------

export interface CreditPerson {
  id: string;
  name: string;
  role: string | null;
  photoUrl: string | null;
}

/**
 * Coarse relation buckets used to group linked content on fiches and, later,
 * to power dedicated franchise/group pages. Keep these stable — UI and the
 * franchise helper both key off them.
 */
export type RelationCategory =
  | "franchise" // suites, préquelles, spin-offs, histoires liées (même univers)
  | "adaptation" // source / adaptation entre médias
  | "recommendation" // suggestions "dans le même esprit"
  | "other";

export interface RelatedMedia {
  key: string;
  source: MediaSource;
  externalId: string;
  title: string;
  posterUrl: string | null;
  /** Human label, e.g. "Suite", "Préquelle", "Recommandé". */
  relation: string;
  relationCategory: RelationCategory;
  mediaType: MediaType;
  /** Optional format hint (Film, OVA, Série TV…) for richer display. */
  format?: string | null;
}

export interface MediaVideo {
  key: string;
  label: string;
  url: string;
}

export interface MediaDetail extends MediaItem {
  trailerUrl: string | null;
  format: string | null;
  seasonLabel: string | null;
  studios: string[];
  popularity: number | null;
  castLabel: string;
  cast: CreditPerson[];
  crewLabel: string;
  crew: CreditPerson[];
  related: RelatedMedia[];
  collectionName: string | null;
  // Étape 1 — richesse métadonnées
  titleAlternatives: string[];
  originSource: string | null;
  ageRating: string | null;
  countryOfOrigin: string | null;
  endDate: string | null;
  videos: MediaVideo[];
}

// ---------- Personal tracking (user data) ----------

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
};

export interface UserEntry {
  key: string;
  source: MediaSource;
  externalId: string;
  mediaType: MediaType;
  title: string;
  posterUrl: string | null;
  status: WatchStatus | null;
  favorite: boolean;
  priority: PriorityLevel;
  notes: string;
  tags: string[];
  updatedAt: number;
}
