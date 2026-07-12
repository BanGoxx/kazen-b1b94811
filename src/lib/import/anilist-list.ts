// KAZEN — AniList list import (browser-direct, public username only).
//
// SAFETY / SCOPE:
//  - Reads ONLY a public AniList profile the user names. No password, no OAuth,
//    no cookies, no session. If the profile is private, AniList returns nothing
//    and we surface a clear message.
//  - Runs client-side against the public GraphQL endpoint. The Cloudflare Worker
//    can be blocked by AniList, so — like the rest of KAZEN's AniList surfaces —
//    the fetch happens in the browser and only neutral ImportEntry[] reach the
//    server backbone (parse → preview → confirm), never the raw account.
//  - Anime only (AniList list type ANIME). Adult titles are skipped.

import type {
  ImportEntry,
  ImportMediaSnapshot,
  ImportStatus,
} from "./import-schema";

const ENDPOINT = "https://graphql.anilist.co";
const PER_CHUNK = 500;

// AniList genre → KAZEN FR label (mirrors anilist-public.ts).
const GENRES: Record<string, string> = {
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

interface AniListEntryMedia {
  id: number;
  isAdult?: boolean | null;
  episodes?: number | null;
  duration?: number | null;
  averageScore?: number | null;
  genres?: string[] | null;
  bannerImage?: string | null;
  title?: { romaji?: string | null; english?: string | null; native?: string | null } | null;
  coverImage?: { extraLarge?: string | null; large?: string | null } | null;
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  externalLinks?: { site?: string | null; url?: string | null }[] | null;
}

interface AniListListEntry {
  status?: string | null;
  progress?: number | null;
  score?: number | null;
  repeat?: number | null;
  notes?: string | null;
  startedAt?: { year?: number | null; month?: number | null; day?: number | null } | null;
  completedAt?: { year?: number | null; month?: number | null; day?: number | null } | null;
  media?: AniListEntryMedia | null;
}

interface CollectionResult {
  MediaListCollection?: {
    hasNextChunk?: boolean | null;
    lists?: { entries?: AniListListEntry[] | null }[] | null;
  } | null;
}

const QUERY = `
  query ($userName: String, $chunk: Int, $perChunk: Int) {
    MediaListCollection(userName: $userName, type: ANIME, chunk: $chunk, perChunk: $perChunk) {
      hasNextChunk
      lists {
        entries {
          status
          progress
          score(format: POINT_10_DECIMAL)
          repeat
          notes
          startedAt { year month day }
          completedAt { year month day }
          media {
            id
            isAdult
            episodes
            duration
            averageScore
            genres
            bannerImage
            title { romaji english native }
            coverImage { extraLarge large }
            startDate { year month day }
            externalLinks { site url }
          }
        }
      }
    }
  }
`;

export class AniListImportError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "PRIVATE" | "EMPTY" | "NETWORK") {
    super(message);
    this.name = "AniListImportError";
  }
}

async function queryCollection(userName: string, chunk: number): Promise<CollectionResult> {
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: QUERY, variables: { userName, chunk, perChunk: PER_CHUNK } }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.status === 404) {
        throw new AniListImportError(
          `Aucun profil AniList public trouvé pour « ${userName} ».`,
          "NOT_FOUND",
        );
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt < MAX_ATTEMPTS) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** (attempt - 1);
          await new Promise((r) => setTimeout(r, Math.min(wait, 5000)));
          continue;
        }
      }
      const json = (await res.json()) as { data?: CollectionResult; errors?: { message?: string; status?: number }[] };
      if (json.errors?.length) {
        const notFound = json.errors.some((e) => e.status === 404 || /not found/i.test(e.message ?? ""));
        if (notFound) {
          throw new AniListImportError(
            `Aucun profil AniList public trouvé pour « ${userName} ».`,
            "NOT_FOUND",
          );
        }
        throw new AniListImportError(json.errors.map((e) => e.message).join("; "), "NETWORK");
      }
      return json.data ?? {};
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof AniListImportError) throw error;
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
        continue;
      }
    }
  }
  throw new AniListImportError(
    "Impossible de contacter AniList. Vérifie ta connexion puis réessaie.",
    "NETWORK",
  );
}

function isoDate(d?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  if (!d?.year) return null;
  const month = String(d.month ?? 1).padStart(2, "0");
  const day = String(d.day ?? 1).padStart(2, "0");
  return `${d.year}-${month}-${day}`;
}

// AniList list status → KAZEN neutral status. REPEATING keeps the title in the
// "watching" bucket and flags a rewatch, matching KAZEN's is_rewatching model.
function mapStatus(status?: string | null): { status: ImportStatus; isRewatching: boolean } {
  switch (status) {
    case "CURRENT":
      return { status: "watching", isRewatching: false };
    case "REPEATING":
      return { status: "watching", isRewatching: true };
    case "COMPLETED":
      return { status: "completed", isRewatching: false };
    case "PAUSED":
      return { status: "paused", isRewatching: false };
    case "DROPPED":
      return { status: "dropped", isRewatching: false };
    case "PLANNING":
      return { status: "planned", isRewatching: false };
    default:
      return { status: "unknown", isRewatching: false };
  }
}

function toEntry(raw: AniListListEntry, importedAt: string): ImportEntry | null {
  const m = raw.media;
  if (!m?.id || m.isAdult) return null;

  const title = m.title?.english || m.title?.romaji || m.title?.native || "Sans titre";
  const altTitles = Array.from(
    new Set(
      [m.title?.romaji, m.title?.english, m.title?.native]
        .map((t) => (t ?? "").trim())
        .filter((t) => t && t !== title),
    ),
  );
  const key = `anilist:${m.id}`;
  const releaseDate = isoDate(m.startDate);
  const platforms = (m.externalLinks ?? [])
    .filter((l) => l?.site && l?.url)
    .map((l) => ({ name: l!.site!, url: l!.url! }));

  const snapshot: ImportMediaSnapshot = {
    key,
    source: "anilist",
    externalId: String(m.id),
    mediaType: "anime",
    title,
    titleOriginal: m.title?.native || m.title?.romaji || null,
    posterUrl: m.coverImage?.extraLarge || m.coverImage?.large || null,
    backdropUrl: m.bannerImage || null,
    releaseDate,
    genres: (m.genres ?? []).map((g) => GENRES[g] ?? g),
    platforms,
    score: m.averageScore ?? null,
  };

  const { status, isRewatching } = mapStatus(raw.status);
  const userScore = typeof raw.score === "number" && raw.score > 0 ? raw.score : null;

  return {
    provider: "anilist",
    providerUrl: `https://anilist.co/anime/${m.id}`,
    providerId: String(m.id),
    title,
    altTitles,
    mediaType: "anime",
    releaseYear: m.startDate?.year ?? null,
    totalEpisodes: m.episodes ?? null,
    status,
    score: userScore,
    progress: typeof raw.progress === "number" ? raw.progress : null,
    startedAt: isoDate(raw.startedAt),
    completedAt: isoDate(raw.completedAt),
    comments: raw.notes?.trim() ? raw.notes.trim() : null,
    userTags: [],
    rewatchCount: typeof raw.repeat === "number" && raw.repeat > 0 ? raw.repeat : null,
    isRewatching,
    mediaKey: key,
    mediaSnapshot: snapshot,
    importedAt,
  };
}

/**
 * Fetch a public AniList anime list by username and normalize it into KAZEN's
 * neutral ImportEntry[]. Runs in the browser; throws AniListImportError with a
 * user-friendly French message on failure.
 */
export async function fetchAniListImport(
  usernameRaw: string,
): Promise<{ entries: ImportEntry[]; warnings: string[]; total: number }> {
  const username = usernameRaw.trim();
  if (!username) {
    throw new AniListImportError("Renseigne ton nom d'utilisateur AniList.", "NOT_FOUND");
  }

  const importedAt = new Date().toISOString();
  const seen = new Set<number>();
  const entries: ImportEntry[] = [];
  let skippedAdult = 0;
  let chunk = 1;

  // Bounded chunk pagination (AniList caps perChunk at 500).
  for (let guard = 0; guard < 20; guard++) {
    const data = await queryCollection(username, chunk);
    const collection = data.MediaListCollection;
    if (!collection) {
      throw new AniListImportError(
        `Aucun profil AniList public trouvé pour « ${username} ».`,
        "NOT_FOUND",
      );
    }
    for (const list of collection.lists ?? []) {
      for (const raw of list.entries ?? []) {
        const id = raw.media?.id;
        if (typeof id === "number") {
          if (seen.has(id)) continue;
          seen.add(id);
        }
        if (raw.media?.isAdult) {
          skippedAdult++;
          continue;
        }
        const entry = toEntry(raw, importedAt);
        if (entry) entries.push(entry);
      }
    }
    if (!collection.hasNextChunk) break;
    chunk++;
  }

  if (entries.length === 0) {
    throw new AniListImportError(
      `La liste d'anime de « ${username} » est vide ou privée. Vérifie que ton profil AniList est public.`,
      "EMPTY",
    );
  }

  const warnings: string[] = [];
  if (skippedAdult > 0) {
    warnings.push(`${skippedAdult} titre(s) pour adultes ignoré(s).`);
  }
  return { entries, warnings, total: entries.length };
}
