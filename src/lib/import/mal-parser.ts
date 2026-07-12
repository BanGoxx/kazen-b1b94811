// KAZEN — MyAnimeList XML importer (Phase 2).
//
// Parses a user-exported MyAnimeList *anime* list (the official
// "Export My List" XML) into the provider-agnostic ImportEntry[] shape.
//
// SAFETY / SCOPE:
//  - Reads ONLY the XML file the user uploads themselves. No login, no cookies,
//    no session tokens, no server-side scraping, no auto-sync.
//  - Imports ONLY the user's own tracking metadata (title, ids, status, score,
//    progress, dates, tags, comments, rewatch info). MAL editorial data
//    (synopsis, images, reviews) is never read.
//  - Runs isomorphically: a tiny hand-rolled XML reader (no DOMParser) so the
//    same code works on server and client, matching the Nautiljon parser style.

import {
  ImportParseError,
  type ImportEntry,
  type ImportMediaType,
  type ImportParseResult,
  type ImportStatus,
} from "./import-schema";

// MAL user_status -> KAZEN neutral status.
//  Watching     -> watching   (en_cours)
//  Completed    -> completed   (termine)
//  On-Hold      -> paused      (en_pause)
//  Dropped      -> dropped     (abandonne)
//  Plan to Watch-> planned     (a_voir)
const MAL_STATUS: Record<string, ImportStatus> = {
  watching: "watching",
  completed: "completed",
  "on-hold": "paused",
  "on hold": "paused",
  onhold: "paused",
  dropped: "dropped",
  "plan to watch": "planned",
  plantowatch: "planned",
};

function malStatus(raw: string): ImportStatus {
  return MAL_STATUS[raw.trim().toLowerCase()] ?? "unknown";
}

// MAL series_type -> KAZEN neutral media type. Everything on an anime export is
// treated as "anime" except explicit movies, which map to "movie" for matching.
function malType(raw: string): ImportMediaType {
  const k = raw.trim().toLowerCase();
  if (k === "movie") return "movie";
  if (!k) return "anime";
  // TV, OVA, ONA, Special, Music, etc. are all anime for our purposes.
  return "anime";
}

// Decode the small set of XML entities MAL emits, and unwrap CDATA.
function decode(v: string): string {
  return v
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

// Read the first <tag>…</tag> value inside a block, or "" when absent.
function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

function toDate(raw: string): string | null {
  const v = raw.trim();
  // MAL uses 0000-00-00 for "not set".
  if (!v || /^0{4}-0{2}-0{2}$/.test(v)) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  if (m[1] === "0000" || m[2] === "00" || m[3] === "00") return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function intOrNull(raw: string): number | null {
  const n = parseInt(raw.trim(), 10);
  return Number.isNaN(n) ? null : n;
}

function scoreOrNull(raw: string): number | null {
  const n = parseFloat(raw.trim());
  if (Number.isNaN(n) || n <= 0) return null; // MAL 0 == "no score"
  return Math.min(10, Math.max(1, n));
}

/** Parse a MyAnimeList XML export into neutral import entries. */
export function parseMalXml(content: string): ImportParseResult {
  const text = (content ?? "").trim();
  if (!text) {
    throw new ImportParseError("Fichier vide.", "EMPTY_INPUT");
  }
  if (!/<myanimelist[\s>]/i.test(text)) {
    throw new ImportParseError(
      "Ce fichier n'est pas un export XML MyAnimeList valide.",
      "UNSUPPORTED_DOCUMENT",
    );
  }

  // Guard against manga exports (user_export_type 2 or <manga> blocks).
  const exportType = tag(text, "user_export_type");
  const hasAnime = /<anime>[\s\S]*?<\/anime>/i.test(text);
  const hasManga = /<manga>[\s\S]*?<\/manga>/i.test(text);
  if ((exportType === "2" || (hasManga && !hasAnime))) {
    throw new ImportParseError(
      "Cet export est une liste de mangas. Seules les listes d'anime sont prises en charge pour le moment.",
      "UNSUPPORTED_DOCUMENT",
    );
  }

  const blocks = text.match(/<anime>[\s\S]*?<\/anime>/gi) ?? [];
  if (blocks.length === 0) {
    throw new ImportParseError(
      "Aucun anime trouvé dans cet export.",
      "NO_LIST_FOUND",
    );
  }

  const now = new Date().toISOString();
  const warnings: string[] = [];
  const seen = new Set<string>();
  const entries: ImportEntry[] = [];
  let missingTitles = 0;
  let dupes = 0;
  let unknownStatus = 0;

  for (const block of blocks) {
    const title = tag(block, "series_title");
    const malId = tag(block, "series_animedb_id");
    if (!title) {
      missingTitles++;
      continue;
    }

    // De-duplicate rows within the same export (by MAL id, else title).
    const dedupeKey = (malId || title).toLowerCase();
    if (seen.has(dedupeKey)) {
      dupes++;
      continue;
    }
    seen.add(dedupeKey);

    const status = malStatus(tag(block, "my_status"));
    if (status === "unknown" && tag(block, "my_status")) unknownStatus++;

    const tagsRaw = tag(block, "my_tags");
    const userTags = tagsRaw
      ? tagsRaw
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const rewatchCount = intOrNull(tag(block, "my_times_watched"));
    const isRewatching = tag(block, "my_rewatching").trim() === "1";

    entries.push({
      provider: "myanimelist",
      providerUrl: malId ? `https://myanimelist.net/anime/${malId}` : null,
      providerId: malId || null,
      title,
      altTitles: [],
      mediaType: malType(tag(block, "series_type")),
      releaseYear: null, // MAL export does not include an air year.
      totalEpisodes: intOrNull(tag(block, "series_episodes")),
      status,
      score: scoreOrNull(tag(block, "my_score")),
      progress: intOrNull(tag(block, "my_watched_episodes")),
      startedAt: toDate(tag(block, "my_start_date")),
      completedAt: toDate(tag(block, "my_finish_date")),
      comments: tag(block, "my_comments") || null,
      userTags,
      rewatchCount,
      isRewatching,
      importedAt: now,
    });
  }

  if (entries.length === 0) {
    throw new ImportParseError(
      "Aucune entrée exploitable dans cet export MyAnimeList.",
      "NO_LIST_FOUND",
    );
  }

  if (missingTitles > 0) warnings.push(`${missingTitles} entrée(s) sans titre ignorée(s).`);
  if (dupes > 0) warnings.push(`${dupes} doublon(s) dans l'export ignoré(s).`);
  if (unknownStatus > 0) warnings.push(`${unknownStatus} statut(s) MAL non reconnu(s).`);

  return {
    provider: "myanimelist",
    entries,
    pagination: { currentPage: 1, totalPages: 1, totalItems: entries.length, hasMore: false },
    warnings,
  };
}
