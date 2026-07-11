// Personalized recommendation engine for KAZEN.
//
// Pure, deterministic, client-side. It consumes the user's personal list
// (favorites, statuses, ratings, notes, tags, genres) to build a "taste
// profile", then scores candidate MediaItems that come from the existing
// discovery pools (trending / popular / upcoming / seasonal). No extra API
// calls, no randomness — the same inputs always produce the same rails.
//
// Cold-start: when the user has no signals (guest or brand-new account), the
// profile is empty and scoring falls back to pure quality + trend + freshness,
// so recommendations still surface strong, current, popular content.

import type { MediaItem, MediaType } from "./media-types";
import type { ListEntry } from "./use-list";

export interface TasteProfile {
  genreWeights: Record<string, number>;
  typeWeights: Record<MediaType, number>;
  tagWeights: Record<string, number>;
  savedKeys: Set<string>;
  /** Keys the user clearly likes (favorite or high rating). */
  likedKeys: Set<string>;
  topGenres: string[];
  topType: MediaType | null;
  /** Number of meaningful interactions — drives cold-start behaviour. */
  signalCount: number;
}

const TYPE_KEYS: MediaType[] = ["anime", "series", "movie"];

/** How much each interaction contributes to the taste profile. */
function entryAffinity(e: ListEntry): number {
  let w = 0;
  if (e.favorite) w += 3;
  switch (e.status) {
    case "en_cours":
      w += 2.5;
      break;
    case "termine":
      w += 2;
      break;
    case "a_voir":
      w += 1;
      break;
    case "en_pause":
      w += 0.5;
      break;
    case "abandonne":
      w -= 1.5;
      break;
    default:
      break;
  }
  if (typeof e.rating === "number") {
    if (e.rating >= 8) w += 2;
    else if (e.rating >= 6) w += 1;
    else if (e.rating <= 4) w -= 1.5;
  }
  if (e.priority === "haute") w += 1;
  return w;
}

export interface ExplicitPreferences {
  genres?: string[];
  types?: string[];
}

export function buildTasteProfile(
  entries: ListEntry[],
  prefs?: ExplicitPreferences,
): TasteProfile {
  const genreWeights: Record<string, number> = {};
  const typeWeights = { anime: 0, series: 0, movie: 0 } as Record<MediaType, number>;
  const tagWeights: Record<string, number> = {};
  const savedKeys = new Set<string>();
  const likedKeys = new Set<string>();
  let signalCount = 0;

  // Seed the profile with the member's explicitly chosen preferences. Given a
  // moderate weight so real interactions can still dominate over time, but
  // enough to personalize a cold-start account right away.
  const PREF_GENRE_WEIGHT = 2.5;
  const PREF_TYPE_WEIGHT = 2.5;
  if (prefs?.genres?.length) {
    for (const g of prefs.genres) {
      genreWeights[g] = (genreWeights[g] ?? 0) + PREF_GENRE_WEIGHT;
    }
    signalCount += 1;
  }
  if (prefs?.types?.length) {
    for (const t of prefs.types) {
      if (t === "anime" || t === "series" || t === "movie") {
        typeWeights[t] += PREF_TYPE_WEIGHT;
      }
    }
    signalCount += 1;
  }

  for (const e of entries) {
    savedKeys.add(e.mediaKey);
    const item = e.item;
    const w = entryAffinity(e);
    if (w > 0) signalCount += 1;
    if (e.favorite || (typeof e.rating === "number" && e.rating >= 8)) {
      likedKeys.add(e.mediaKey);
    }
    for (const tag of e.tags) {
      const key = tag.trim().toLowerCase();
      if (key) tagWeights[key] = (tagWeights[key] ?? 0) + Math.max(w, 0.5);
    }
    if (!item) continue;
    if (item.mediaType) typeWeights[item.mediaType] += w;
    for (const g of item.genres) {
      genreWeights[g] = (genreWeights[g] ?? 0) + w;
    }
  }

  const topGenres = Object.entries(genreWeights)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([g]) => g);

  let topType: MediaType | null = null;
  let best = 0;
  for (const t of TYPE_KEYS) {
    if (typeWeights[t] > best) {
      best = typeWeights[t];
      topType = t;
    }
  }

  return {
    genreWeights,
    typeWeights,
    tagWeights,
    savedKeys,
    likedKeys,
    topGenres,
    topType,
    signalCount,
  };
}

// ---------- Scoring ----------

function qualityScore(item: MediaItem): number {
  // score is 0-100; normalize to 0-1 and mildly reward.
  return item.score != null ? item.score / 100 : 0.45;
}

function freshnessScore(item: MediaItem): number {
  if (!item.releaseDate) return 0.3;
  const t = new Date(item.releaseDate).getTime();
  if (Number.isNaN(t)) return 0.3;
  const days = (Date.now() - t) / (1000 * 60 * 60 * 24);
  if (days < 0) return 0.9; // upcoming → very fresh
  if (days < 120) return 0.8;
  if (days < 365) return 0.6;
  if (days < 365 * 3) return 0.4;
  return 0.25;
}

function personalScore(item: MediaItem, p: TasteProfile): number {
  if (p.signalCount === 0) return 0;
  let match = 0;
  const maxGenre = Math.max(1, ...Object.values(p.genreWeights));
  for (const g of item.genres) {
    const w = p.genreWeights[g];
    if (w && w > 0) match += w / maxGenre;
  }
  const genreMatch = Math.min(match, 3) / 3; // 0-1

  const typeTotal = TYPE_KEYS.reduce((s, t) => s + Math.max(p.typeWeights[t], 0), 0) || 1;
  const typeMatch = Math.max(p.typeWeights[item.mediaType] ?? 0, 0) / typeTotal;

  return genreMatch * 0.75 + typeMatch * 0.25; // 0-1
}

export interface ScoredMedia {
  item: MediaItem;
  score: number;
  reasonGenres: string[];
}

/**
 * Blended relevance score. `personalWeight` scales up as the user interacts
 * more (0 for cold-start, capped once they have enough signals), so discovery
 * (quality/trend/freshness) always keeps a strong floor.
 */
export function scoreItem(item: MediaItem, p: TasteProfile, trendRank = 0.5): number {
  const personal = personalScore(item, p);
  const quality = qualityScore(item);
  const fresh = freshnessScore(item);
  // trendRank: 0 (bottom of source list) .. 1 (top). Source order is a strong
  // popularity/trend proxy that we always keep visible.
  const discovery = quality * 0.4 + trendRank * 0.4 + fresh * 0.2;

  // Personalization ramps up but is capped: keeps trends/popular present.
  const pWeight = Math.min(p.signalCount, 12) / 12; // 0 → 1
  const personalShare = 0.55 * pWeight;
  return personal * personalShare + discovery * (1 - personalShare);
}

function reasonGenres(item: MediaItem, p: TasteProfile): string[] {
  return item.genres.filter((g) => (p.genreWeights[g] ?? 0) > 0).slice(0, 2);
}

/** Deduplicate a pool by media key and drop items missing a poster. */
export function normalizePool(pools: MediaItem[][]): MediaItem[] {
  const seen = new Set<string>();
  const out: MediaItem[] = [];
  for (const pool of pools) {
    const n = pool.length;
    for (let i = 0; i < n; i++) {
      const it = pool[i];
      if (!it || !it.key || seen.has(it.key)) continue;
      seen.add(it.key);
      out.push(it);
    }
  }
  return out;
}

/** Rank a candidate pool for a user, optionally excluding already-saved keys. */
export function rankForYou(
  pool: MediaItem[],
  profile: TasteProfile,
  opts: { excludeSaved?: boolean; limit?: number; rankBySourceOrder?: boolean } = {},
): ScoredMedia[] {
  const { excludeSaved = true, limit = 24, rankBySourceOrder = true } = opts;
  const n = pool.length || 1;
  const scored = pool
    .map((item, i) => {
      const trendRank = rankBySourceOrder ? 1 - i / n : 0.5;
      return {
        item,
        score: scoreItem(item, profile, trendRank),
        reasonGenres: reasonGenres(item, profile),
      };
    })
    .filter((s) => !(excludeSaved && profile.savedKeys.has(s.item.key)));
  scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "fr"));
  return scored.slice(0, limit);
}

/** Items strongly matching a single anchor genre — "Parce que vous aimez…". */
export function rankByGenre(
  pool: MediaItem[],
  profile: TasteProfile,
  genre: string,
  limit = 20,
): MediaItem[] {
  return pool
    .filter((it) => it.genres.includes(genre) && !profile.savedKeys.has(it.key))
    .map((it, i) => ({ it, s: scoreItem(it, profile, 1 - i / (pool.length || 1)) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.it);
}

/** Newer / upcoming candidates that also fit the taste profile. */
export function rankFreshForYou(pool: MediaItem[], profile: TasteProfile, limit = 20): MediaItem[] {
  return pool
    .filter((it) => !profile.savedKeys.has(it.key) && freshnessScore(it) >= 0.8)
    .map((it, i) => ({
      it,
      s: personalScore(it, profile) * 0.6 + freshnessScore(it) * 0.4 + (1 - i / (pool.length || 1)) * 0.1,
    }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.it);
}

/**
 * Hidden-gem discovery: good genre fit but lower in the popularity order, so it
 * feels like a personal find rather than the same trending titles.
 */
export function rankDiscovery(pool: MediaItem[], profile: TasteProfile, limit = 20): MediaItem[] {
  const half = Math.floor(pool.length / 2);
  return pool
    .map((it, i) => ({ it, i }))
    .filter(({ it, i }) => i >= half && !profile.savedKeys.has(it.key) && personalScore(it, profile) > 0.1)
    .map(({ it }) => ({ it, s: personalScore(it, profile) * 0.7 + qualityScore(it) * 0.3 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.it);
}
