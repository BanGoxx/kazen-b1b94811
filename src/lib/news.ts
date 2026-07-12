import type { MediaSource } from "./media-types";
import type { FicheArticle } from "@/components/media/FicheArticles";

/**
 * KAZEN title-scoped news / editorial layer (Step C foundation).
 *
 * This module owns the data model, linkage, and normalization for
 * title-specific articles. It is intentionally source-agnostic so a real
 * editorial source (CMS, RSS, Supabase table…) can plug in later without
 * touching the fiche or the article route.
 *
 * Safety contract:
 *  - `NEWS_ARTICLES` starts empty. We NEVER fabricate articles or inject
 *    generic anime news into a title fiche.
 *  - Linkage is explicit: an article surfaces on a fiche only when it is tied
 *    to that exact title (source + externalId) or to its universe anchor.
 *  - Consumers hide gracefully when the returned list is empty.
 */

export interface NewsTitleRef {
  source: MediaSource;
  externalId: string;
}

export interface NewsArticle {
  /** Stable, URL-safe identifier used at /actualites/$slug. */
  slug: string;
  title: string;
  /** Short French summary shown on cards. */
  excerpt: string;
  /** French-first body, one entry per paragraph. */
  body: string[];
  /** ISO date string. */
  publishedAt: string;
  /** Editorial source label, e.g. "KAZEN". */
  source: string;
  thumbnailUrl?: string | null;
  /** Titles this article is directly about. */
  titles: NewsTitleRef[];
  /** Optional universe anchors ("source:externalId") for franchise-level news. */
  universeKeys?: string[];
  /**
   * When set, the article is an external redirect (no internal page). Internal
   * articles (no `externalUrl`) render at /actualites/$slug.
   */
  externalUrl?: string | null;
}

/**
 * Editorial registry. Empty by design until a safe, title-scoped source is
 * wired. Add real, verified entries here (or replace with a fetched source)
 * to light up the fiche block — never placeholder content.
 */
export const NEWS_ARTICLES: NewsArticle[] = [];

function titleKey(ref: NewsTitleRef): string {
  return `${ref.source}:${ref.externalId}`;
}

function byRecent(a: NewsArticle, b: NewsArticle): number {
  const ta = new Date(a.publishedAt).getTime();
  const tb = new Date(b.publishedAt).getTime();
  return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
}

/**
 * Articles directly linked to a title, optionally including its universe
 * anchor so franchise-level news can surface on member titles.
 */
export function getArticlesForTitle(
  source: MediaSource,
  externalId: string,
  universeKey?: string | null,
): NewsArticle[] {
  const self = `${source}:${externalId}`;
  return NEWS_ARTICLES.filter((a) => {
    const matchesTitle = a.titles.some((t) => titleKey(t) === self);
    const matchesUniverse =
      !!universeKey && (a.universeKeys ?? []).includes(universeKey);
    return matchesTitle || matchesUniverse;
  }).sort(byRecent);
}

export function getArticleBySlug(slug: string): NewsArticle | null {
  return NEWS_ARTICLES.find((a) => a.slug === slug && !a.externalUrl) ?? null;
}

/** Normalize a NewsArticle into the presentational FicheArticle shape. */
export function toFicheArticle(a: NewsArticle): FicheArticle {
  return {
    id: a.slug,
    title: a.title,
    source: a.source,
    publishedAt: a.publishedAt,
    excerpt: a.excerpt,
    url: a.externalUrl ?? null,
    slug: a.externalUrl ? null : a.slug,
    thumbnailUrl: a.thumbnailUrl ?? null,
  };
}
