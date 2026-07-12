// KAZEN — Neutral list-import schema (discovery spike / prototype).
//
// Provider-independent representation of ONE tracked entry as read from an
// external tracking site. Designed to be reused later for Nautiljon,
// MyAnimeList, AniList, Anime-Planet and Simkl. It deliberately maps cleanly
// onto KAZEN's existing storage so no destructive change is ever required:
//
//   media_records: media_key = `${source}:${externalId}`, title, title_original,
//                  media_type, release_date, score, ...
//   list_items:    status (watch_status), rating (smallint 1-10), favorite,
//                  priority, notes, tags[]
//
// NOTE: KAZEN currently has NO column for episode progress nor start/completion
// dates on list_items. Those fields are captured here for fidelity but require
// additive schema changes before they can be persisted (see spike report).

export type ImportProvider =
  | "nautiljon"
  | "myanimelist"
  | "anilist"
  | "anime-planet"
  | "simkl";

// Provider-neutral media type; mapped to KAZEN MediaType at match time.
export type ImportMediaType = "anime" | "manga" | "series" | "movie" | "unknown";

// Provider-neutral watch status. Every provider label is normalized into this
// closed set, which maps 1:1 onto KAZEN's watch_status enum
// (a_voir | en_cours | termine | en_pause | abandonne).
export type ImportStatus =
  | "planned" // -> a_voir
  | "watching" // -> en_cours
  | "completed" // -> termine
  | "paused" // -> en_pause
  | "dropped" // -> abandonne
  | "unknown";

/** A single tracked entry, provider-independent. */
export interface ImportEntry {
  /** Source site the row came from. */
  provider: ImportProvider;
  /** Canonical URL of the item on the provider, when present in the row. */
  providerUrl: string | null;
  /** Provider-native id when derivable from the URL/markup (else null). */
  providerId: string | null;

  title: string;
  /** Any alternative titles found in the row (romaji, english, native, FR…). */
  altTitles: string[];

  mediaType: ImportMediaType;
  /** Release year when present. */
  releaseYear: number | null;
  /** Total episodes when present. */
  totalEpisodes: number | null;

  status: ImportStatus;
  /** User score on a 0-10 scale (rescaled per provider), or null. */
  score: number | null;
  /** Episodes the user has watched, or null. */
  progress: number | null;

  /** ISO dates (YYYY-MM-DD) when the provider exposes them. */
  startedAt: string | null;
  completedAt: string | null;

  /** When this entry was parsed (import run timestamp). */
  importedAt: string;
}

/** Result of parsing a saved provider page. */
export interface ImportParseResult {
  provider: ImportProvider;
  entries: ImportEntry[];
  /** Pagination hints detected in the markup, if any. */
  pagination: {
    currentPage: number | null;
    totalPages: number | null;
    totalItems: number | null;
    hasMore: boolean;
  };
  /** Non-fatal issues (skipped rows, missing fields…). */
  warnings: string[];
}

/** Thrown for fatal parse failures (unrecognized document, no list found). */
export class ImportParseError extends Error {
  constructor(
    message: string,
    readonly code:
      | "EMPTY_INPUT"
      | "NO_LIST_FOUND"
      | "UNSUPPORTED_DOCUMENT"
      | "PARSER_UNAVAILABLE",
  ) {
    super(message);
    this.name = "ImportParseError";
  }
}

/** Maps the neutral status onto KAZEN's watch_status enum value. */
export function toKazenStatus(
  s: ImportStatus,
): "a_voir" | "en_cours" | "termine" | "en_pause" | "abandonne" | null {
  switch (s) {
    case "planned":
      return "a_voir";
    case "watching":
      return "en_cours";
    case "completed":
      return "termine";
    case "paused":
      return "en_pause";
    case "dropped":
      return "abandonne";
    default:
      return null;
  }
}

/** Clamps a 0-10 neutral score onto KAZEN's smallint 1-10 rating (or null). */
export function toKazenRating(score: number | null): number | null {
  if (score == null || Number.isNaN(score)) return null;
  const r = Math.round(score);
  if (r < 1) return null;
  return Math.min(10, r);
}
