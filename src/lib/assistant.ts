// Lightweight French recommendation assistant.
//
// Parses a free-text request ("un anime horreur shonen", "film récent bien
// noté", "série sci-fi") into structured intents (type, genres, sort emphasis)
// and ranks candidates from the already-loaded discovery pools. Deterministic,
// rule-based, no external calls — a strong V1 without a heavy AI system.

import type { MediaItem, MediaType } from "./media-types";
import type { TasteProfile } from "./recommend";
import { scoreItem } from "./recommend";

export type SortEmphasis = "relevance" | "recent" | "popular" | "quality";

export interface ParsedIntent {
  type: MediaType | null;
  genres: string[];
  emphasis: SortEmphasis;
  keywords: string[];
}

// Type detection.
const TYPE_WORDS: { re: RegExp; type: MediaType }[] = [
  { re: /\banim[ée]s?\b|\bmanga\b|\bshonen\b|\bshojo\b|\bseinen\b|\bisekai\b/i, type: "anime" },
  { re: /\bs[ée]ries?\b|\bshow\b|\bfeuilletons?\b/i, type: "series" },
  { re: /\bfilms?\b|\bmovies?\b|\blong[- ]?m[ée]trages?\b|\bcin[ée]ma\b/i, type: "movie" },
];

// FR genre synonyms → canonical FR genre label used across the app.
const GENRE_WORDS: { re: RegExp; genre: string }[] = [
  { re: /\bhorreur\b|\bhorror\b|\bpeur\b|\beffrayant/i, genre: "Horreur" },
  { re: /\baction\b/i, genre: "Action" },
  { re: /\baventure/i, genre: "Aventure" },
  { re: /\bcom[ée]die|\bdr[ôo]le|\bhumour/i, genre: "Comédie" },
  { re: /\bromance|\bromantique|\bamour\b/i, genre: "Romance" },
  { re: /\bdrame|\bdramatique/i, genre: "Drame" },
  { re: /\bthriller|\bsuspense/i, genre: "Thriller" },
  { re: /\bmyst[èe]re|\benqu[êe]te|\bpolicier/i, genre: "Mystère" },
  { re: /\bsci[- ]?fi|\bscience[- ]?fiction|\bespace\b|\bfutur/i, genre: "Science-Fiction" },
  { re: /\bfantastique|\bfantasy|\bmagie|\bmagique/i, genre: "Fantastique" },
  { re: /\bsurnaturel|\bsupernatural/i, genre: "Surnaturel" },
  { re: /\bpsychologique/i, genre: "Psychologique" },
  { re: /\bsport/i, genre: "Sport" },
  { re: /\bmecha|\brobot/i, genre: "Mecha" },
  { re: /\bmusique|\bmusical/i, genre: "Musique" },
  { re: /\btranche de vie|\bslice of life|\bquotidien/i, genre: "Tranche de vie" },
  { re: /\bcrime|\bmafia|\bgangster/i, genre: "Crime" },
  { re: /\bguerre\b/i, genre: "Guerre" },
  { re: /\bfamille|\bfamilial|\benfants?\b/i, genre: "Familial" },
  { re: /\bhistoire|\bhistorique/i, genre: "Histoire" },
  { re: /\bdocumentaire/i, genre: "Documentaire" },
  { re: /\bwestern/i, genre: "Western" },
];

const EMPHASIS_WORDS: { re: RegExp; emphasis: SortEmphasis }[] = [
  { re: /\br[ée]cent|\bnouveau|\bnouveaut[ée]|\bderni[èe]r|\b2024|\b2025|\b2026\b/i, emphasis: "recent" },
  { re: /\bpopulaire|\btendance|\bconnu|\bc[ée]l[èe]bre/i, emphasis: "popular" },
  { re: /\bmeilleur|\bbien not[ée]|\bexcellent|\btop\b|\bqualit[ée]/i, emphasis: "quality" },
];

export function parseIntent(input: string): ParsedIntent {
  const q = input.trim();
  let type: MediaType | null = null;
  for (const t of TYPE_WORDS) {
    if (t.re.test(q)) {
      type = t.type;
      break;
    }
  }
  const genres: string[] = [];
  for (const g of GENRE_WORDS) {
    if (g.re.test(q) && !genres.includes(g.genre)) genres.push(g.genre);
  }
  let emphasis: SortEmphasis = "relevance";
  for (const e of EMPHASIS_WORDS) {
    if (e.re.test(q)) {
      emphasis = e.emphasis;
      break;
    }
  }
  const keywords = q
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  return { type, genres, emphasis, keywords };
}

function emphasisScore(item: MediaItem, emphasis: SortEmphasis, sourceRank: number): number {
  switch (emphasis) {
    case "recent": {
      if (!item.releaseDate) return 0.2;
      const days = (Date.now() - new Date(item.releaseDate).getTime()) / 86400000;
      return days < 0 ? 1 : days < 180 ? 0.85 : days < 730 ? 0.5 : 0.2;
    }
    case "popular":
      return sourceRank;
    case "quality":
      return item.score != null ? item.score / 100 : 0.4;
    default:
      return sourceRank * 0.5;
  }
}

export interface AssistantResult {
  intent: ParsedIntent;
  items: MediaItem[];
}

export function runAssistant(
  input: string,
  pool: MediaItem[],
  profile: TasteProfile,
  limit = 12,
): AssistantResult {
  const intent = parseIntent(input);
  const n = pool.length || 1;

  const scored = pool
    .map((item, i) => {
      const sourceRank = 1 - i / n;
      let ok = true;
      if (intent.type && item.mediaType !== intent.type) ok = false;
      // Require at least one requested genre when genres are specified.
      let genreHits = 0;
      if (intent.genres.length) {
        genreHits = intent.genres.filter((g) => item.genres.includes(g)).length;
        if (genreHits === 0) ok = false;
      }
      // Free keyword match on title as a light bonus.
      const title = item.title.toLowerCase();
      const kwHits = intent.keywords.filter((k) => title.includes(k)).length;

      const base =
        emphasisScore(item, intent.emphasis, sourceRank) * 0.5 +
        scoreItem(item, profile, sourceRank) * 0.3 +
        (genreHits / Math.max(intent.genres.length, 1)) * 0.2 +
        kwHits * 0.15;
      return { item, ok, base };
    })
    .filter((s) => s.ok)
    .sort((a, b) => b.base - a.base || a.item.title.localeCompare(b.item.title, "fr"));

  let items = scored.slice(0, limit).map((s) => s.item);

  // Graceful fallback: if strict filters return nothing, relax the genre
  // requirement and keep the type + emphasis so the user still gets answers.
  if (!items.length) {
    const relaxed = pool
      .map((item, i) => ({
        item,
        ok: !intent.type || item.mediaType === intent.type,
        base: emphasisScore(item, intent.emphasis, 1 - i / n),
      }))
      .filter((s) => s.ok)
      .sort((a, b) => b.base - a.base)
      .slice(0, limit)
      .map((s) => s.item);
    items = relaxed;
  }

  return { intent, items };
}

export function describeIntent(intent: ParsedIntent): string {
  const parts: string[] = [];
  if (intent.type) {
    parts.push(intent.type === "anime" ? "anime" : intent.type === "series" ? "séries" : "films");
  }
  if (intent.genres.length) parts.push(intent.genres.join(" · "));
  const emphasisLabel: Record<SortEmphasis, string> = {
    relevance: "",
    recent: "récents",
    popular: "populaires",
    quality: "les mieux notés",
  };
  if (emphasisLabel[intent.emphasis]) parts.push(emphasisLabel[intent.emphasis]);
  return parts.length ? parts.join(" · ") : "toutes catégories";
}
