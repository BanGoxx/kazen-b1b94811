// Reliable season-chain derivation for KAZEN fiches.
//
// Seasons are built ONLY from confident provider relationship signals — direct
// "Suite" (sequel) and "Préquelle" (prequel) anime links — never inferred from
// title text. Films, OVA/specials, spin-offs, side stories, alternative
// versions and summaries are deliberately excluded so a fiche never presents a
// film as a season or invents an ordering.

import type { MediaDetail, RelatedMedia } from "./media-types";

export interface SeasonEntry {
  key: string;
  source: RelatedMedia["source"];
  externalId: string;
  title: string;
  posterUrl: string | null;
  year: number | null;
  /** Episode count when reliably known (current fiche only for now). */
  episodesCount: number | null;
  /** Chronological season position when confidently orderable, else null. */
  seasonNumber: number | null;
  isCurrent: boolean;
}

export interface SeasonChain {
  entries: SeasonEntry[];
  /** Index of the current fiche inside `entries`. */
  currentIndex: number;
  /** Total seasons when the whole chain is confidently ordered, else null. */
  total: number | null;
}

// Only these two relations describe a linear season progression. Everything
// else (Spin-off, Histoire parallèle, Version alternative, Résumé, Œuvre
// parente, adaptations…) is NOT a season and must never enter the chain.
const SEASON_RELATIONS = new Set(["Suite", "Préquelle"]);
const FILM_RE = /film|movie/i;

/** True when a related item is a confident same-line anime season neighbour. */
function isSeasonNeighbour(it: RelatedMedia): boolean {
  if (it.relationCategory !== "franchise") return false;
  if (!SEASON_RELATIONS.has(it.relation)) return false;
  // Season chain is an anime-series concern: exclude non-anime formats and
  // films, which are linked works, not seasons.
  const fg = it.formatGroup ?? "anime";
  if (fg !== "anime") return false;
  if (FILM_RE.test(it.format ?? "")) return false;
  return true;
}

/**
 * Build a confident season chain (previous → current → next) from a fiche's
 * detail. Returns null when there is no reliable sequel/prequel signal so the
 * fiche shows no season navigator rather than a fabricated one.
 */
export function buildSeasonChain(detail: MediaDetail): SeasonChain | null {
  if (detail.mediaType === "movie") return null;

  const neighbours = detail.related.filter(isSeasonNeighbour);
  if (neighbours.length === 0) return null;

  const selfYear = detail.releaseDate
    ? Number(detail.releaseDate.slice(0, 4)) || null
    : null;

  const selfEntry: SeasonEntry = {
    key: detail.key,
    source: detail.source,
    externalId: detail.externalId,
    title: detail.title,
    posterUrl: detail.posterUrl,
    year: selfYear,
    episodesCount: detail.episodesCount,
    seasonNumber: null,
    isCurrent: true,
  };

  const seen = new Set<string>([selfEntry.key]);
  const entries: SeasonEntry[] = [selfEntry];
  for (const n of neighbours) {
    if (!n.key || seen.has(n.key)) continue;
    seen.add(n.key);
    entries.push({
      key: n.key,
      source: n.source,
      externalId: n.externalId,
      title: n.title,
      posterUrl: n.posterUrl,
      year: n.year ?? null,
      episodesCount: null,
      seasonNumber: null,
      isCurrent: false,
    });
  }

  if (entries.length < 2) return null;

  // Confident chronological order requires known years. When any entry lacks a
  // year we still order prequels-before / sequels-after the current fiche using
  // the declared relation, but we do NOT assign hard season numbers.
  const allYearsKnown = entries.every((e) => typeof e.year === "number");

  if (allYearsKnown) {
    entries.sort((a, b) => (a.year! - b.year!) || a.title.localeCompare(b.title, "fr"));
    entries.forEach((e, i) => {
      e.seasonNumber = i + 1;
    });
  } else {
    // Relation-anchored order without numbers: préquelles first, then self,
    // then suites — a safe, non-inventing fallback.
    const rank = (e: SeasonEntry): number => {
      if (e.isCurrent) return 0;
      const rel = detail.related.find((r) => r.key === e.key)?.relation;
      return rel === "Préquelle" ? -1 : 1;
    };
    entries.sort((a, b) => rank(a) - rank(b));
  }

  const currentIndex = entries.findIndex((e) => e.isCurrent);
  return {
    entries,
    currentIndex,
    total: allYearsKnown ? entries.length : null,
  };
}
