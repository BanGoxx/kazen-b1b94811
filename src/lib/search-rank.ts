import type { MediaItem } from "./media-types";

// Lightweight relevance ranking for the predictive search dropdown.
// Combines strong prefix matching with a light fuzzy (subsequence + edit
// distance) fallback, then blends in popularity/score and a small quality
// boost so the most relevant, well-rated titles surface first.

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .trim();
}

// Small bounded edit distance — enough for short, imperfect queries.
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Ordered subsequence check: does every query char appear in order? Cheap fuzzy.
function isSubsequence(query: string, target: string): boolean {
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) qi++;
  }
  return qi === query.length;
}

/** Relevance score of a single title against the query. Higher = better. */
function titleScore(query: string, rawTitle: string): number {
  const t = normalize(rawTitle);
  if (!t) return 0;

  if (t === query) return 1000; // exact
  if (t.startsWith(query)) return 720; // strong prefix

  // Word-boundary prefix ("na" -> "... Naruto") is very relevant.
  const words = t.split(/[\s:!?.,'-]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(query))) return 560;

  if (t.includes(query)) return 380; // substring

  // Light fuzzy: ordered subsequence, then a bounded edit-distance check.
  if (query.length >= 3 && isSubsequence(query, t)) return 220;
  if (query.length >= 3) {
    const best = Math.min(...words.map((w) => editDistance(query, w)), editDistance(query, t.slice(0, query.length + 2)));
    if (best <= 1) return 260;
    if (best <= 2) return 160;
  }
  return 0;
}

export interface RankedItem {
  item: MediaItem;
  score: number;
}

/** Rank a merged pool of media items for the predictive dropdown. */
export function rankSuggestions(query: string, pool: MediaItem[], limit = 7): MediaItem[] {
  const q = normalize(query);
  if (!q) return [];

  const seen = new Set<string>();
  const ranked: RankedItem[] = [];

  for (const item of pool) {
    if (seen.has(item.key)) continue;
    const rel = Math.max(titleScore(q, item.title), item.titleOriginal ? titleScore(q, item.titleOriginal) * 0.9 : 0);
    if (rel <= 0) continue;
    seen.add(item.key);

    // Popularity / trend / quality proxy: normalized score (0-100).
    const quality = item.score != null ? item.score : 45; // neutral default
    // Blend: relevance dominates, quality breaks ties and lifts strong titles.
    const finalScore = rel + quality * 0.6;
    ranked.push({ item, score: finalScore });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit).map((r) => r.item);
}
