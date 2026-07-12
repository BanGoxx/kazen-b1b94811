// KAZEN — Import matching & confidence scoring (discovery prototype, pure fns).
//
// Matches a neutral ImportEntry against KAZEN media candidates (returned by the
// existing AniList/TMDB search — e.g. `anilistSearchPaged`). No side effects,
// no writes. The caller supplies candidates; this module only scores + ranks.

import type { ImportEntry } from "./import-schema";
import type { MediaItem } from "../media-types";

export type MatchClass =
  | "exact" // safe to import
  | "probable" // needs user confirmation
  | "unmatched" // nothing credible
  | "duplicate"; // already present in the user's KAZEN list

export interface MatchResult {
  entry: ImportEntry;
  candidate: MediaItem | null;
  confidence: number; // 0..1
  classification: MatchClass;
  /** Human-readable reasons for the score (debug/preview). */
  reasons: string[];
}

/** Aggressive title normalization for comparison (accent/punct/space-insensitive). */
export function normTitle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(season|saison|s|part|partie|cour)\b\s*\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalized similarity in 0..1, blending edit distance with token containment. */
export function titleSimilarity(a: string, b: string): number {
  const s = normTitle(a);
  const t = normTitle(b);
  if (!s || !t) return 0;
  if (s === t) return 1;

  // Edit-distance similarity.
  const m = s.length;
  const n = t.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const edit = 1 - dp[m][n] / Math.max(m, n);

  // Token-containment similarity: how many of the shorter title's tokens appear
  // in the longer one (handles "Frieren" vs "Frieren: Beyond Journey's End").
  const sa = new Set(s.split(" "));
  const sb = new Set(t.split(" "));
  const [small, big] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
  let hit = 0;
  small.forEach((tok) => {
    if (big.has(tok)) hit++;
  });
  const contain = small.size ? hit / small.size : 0;

  return Math.max(edit, contain);
}


/** Best title similarity across the entry's title + alt titles vs a candidate. */
function bestTitleSim(entry: ImportEntry, cand: MediaItem): number {
  const entryTitles = [entry.title, ...entry.altTitles].filter(Boolean);
  const candTitles = [cand.title, cand.titleOriginal].filter(Boolean) as string[];
  let best = 0;
  for (const e of entryTitles) {
    for (const c of candTitles) {
      best = Math.max(best, titleSimilarity(e, c));
    }
  }
  return best;
}

function candYear(cand: MediaItem): number | null {
  if (!cand.releaseDate) return null;
  const y = parseInt(cand.releaseDate.slice(0, 4), 10);
  return Number.isNaN(y) ? null : y;
}

function typeCompatible(entry: ImportEntry, cand: MediaItem): boolean {
  if (entry.mediaType === "unknown") return true;
  if (entry.mediaType === "movie") return cand.mediaType === "movie";
  if (entry.mediaType === "series") return cand.mediaType === "series" || cand.mediaType === "anime";
  if (entry.mediaType === "anime") return cand.mediaType === "anime";
  return true;
}

export interface ScoreOptions {
  /** media_keys already in the user's KAZEN list, for duplicate detection. */
  existingKeys?: Set<string>;
  exactThreshold?: number; // default 0.9
  probableThreshold?: number; // default 0.7
}

/**
 * Score a single entry against a ranked candidate list (best first) and pick
 * the winner. Confidence blends title similarity (dominant), year, type and
 * episode-count agreement, plus an ID-equality shortcut.
 */
export function scoreEntry(
  entry: ImportEntry,
  candidates: MediaItem[],
  opts: ScoreOptions = {},
): MatchResult {
  const exactT = opts.exactThreshold ?? 0.9;
  const probT = opts.probableThreshold ?? 0.7;

  let best: MatchResult = {
    entry,
    candidate: null,
    confidence: 0,
    classification: "unmatched",
    reasons: ["Aucun candidat crédible."],
  };

  for (const cand of candidates) {
    const reasons: string[] = [];

    // Hard ID match shortcut (e.g. Nautiljon rarely exposes AniList ids, but
    // future providers like AniList/MAL do).
    const idMatch =
      entry.providerId != null &&
      (cand.externalId === entry.providerId || cand.key === `${entry.provider}:${entry.providerId}`);

    const titleSim = bestTitleSim(entry, cand);
    let confidence = titleSim * 0.7;
    reasons.push(`Titre ${(titleSim * 100).toFixed(0)}%`);

    const cy = candYear(cand);
    if (entry.releaseYear && cy) {
      const diff = Math.abs(entry.releaseYear - cy);
      if (diff === 0) {
        confidence += 0.15;
        reasons.push("Année identique");
      } else if (diff === 1) {
        confidence += 0.05;
        reasons.push("Année ±1");
      } else {
        confidence -= 0.1;
        reasons.push(`Année écart ${diff}`);
      }
    }

    if (typeCompatible(entry, cand)) {
      confidence += 0.1;
      reasons.push("Type compatible");
    } else {
      confidence -= 0.25;
      reasons.push("Type incompatible");
    }

    if (entry.totalEpisodes && cand.episodesCount) {
      if (entry.totalEpisodes === cand.episodesCount) {
        confidence += 0.05;
        reasons.push("Nb épisodes identique");
      }
    }

    if (idMatch) {
      confidence = Math.max(confidence, 0.98);
      reasons.unshift("Identifiant externe correspondant");
    }

    confidence = Math.max(0, Math.min(1, confidence));

    if (confidence > best.confidence) {
      best = { entry, candidate: cand, confidence, classification: "unmatched", reasons };
    }
  }

  // Classify.
  if (best.candidate) {
    if (opts.existingKeys?.has(best.candidate.key) && best.confidence >= probT) {
      best.classification = "duplicate";
    } else if (best.confidence >= exactT) {
      best.classification = "exact";
    } else if (best.confidence >= probT) {
      best.classification = "probable";
    } else {
      best.classification = "unmatched";
      best.candidate = best.confidence >= probT ? best.candidate : best.candidate; // keep hint
    }
  }

  return best;
}

/** Summarize a batch of match results for the preview UX. */
export function summarize(results: MatchResult[]) {
  const by = (c: MatchClass) => results.filter((r) => r.classification === c).length;
  return {
    total: results.length,
    exact: by("exact"),
    probable: by("probable"),
    unmatched: by("unmatched"),
    duplicate: by("duplicate"),
  };
}
