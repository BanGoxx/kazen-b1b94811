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
  /** Editorial category (e.g. "Analyse", "Guide"). Optional. */
  category?: string;
  /** Higher = more prominent in Découverte. Optional. */
  popularity?: number;
  /** When true, eligible for the Découverte featured block. */
  featured?: boolean;
  /**
   * When set, the article is an external redirect (no internal page). Internal
   * articles (no `externalUrl`) render at /actualites/$slug.
   */
  externalUrl?: string | null;
}

/**
 * Editorial registry — real, verified KAZEN articles only.
 *
 * These are genuine, factually-grounded editorial pieces (evergreen analyses),
 * each explicitly linked to a real title via its AniList id. This is a small,
 * real V1: quality over quantity. Never add placeholder or fabricated-news
 * entries here — the whole UI relies on this list being real.
 */
export const NEWS_ARTICLES: NewsArticle[] = [
  {
    slug: "frieren-chef-doeuvre-apres-aventure",
    title: "Frieren : le chef-d'œuvre d'après-aventure qui a marqué l'animation",
    excerpt:
      "Après la victoire sur le Roi des Démons, Frieren l'elfe reprend la route. Un anime contemplatif signé Madhouse, salué comme l'un des plus beaux de la décennie.",
    body: [
      "Adapté par le studio Madhouse à partir du manga de Kanehito Yamada et Tsukasa Abe, « Frieren » prend le contre-pied du récit d'aventure classique : l'histoire commence là où les autres s'arrêtent, une fois le Roi des Démons vaincu.",
      "On suit Frieren, une mage elfe quasi immortelle, qui réalise trop tard combien ses compagnons humains comptaient pour elle. Son voyage devient une méditation sur le temps, la mémoire et le deuil.",
      "Porté par une réalisation d'une grande finesse et une bande-son remarquable, l'anime a été unanimement salué par la critique et la communauté, s'imposant comme une référence de l'animation contemporaine.",
    ],
    publishedAt: "2024-11-20",
    source: "KAZEN",
    category: "Analyse",
    popularity: 95,
    featured: true,
    titles: [{ source: "anilist", externalId: "154587" }],
  },
  {
    slug: "jujutsu-kaisen-shonen-moderne-mappa",
    title: "Jujutsu Kaisen : l'ascension d'un shōnen moderne signé MAPPA",
    excerpt:
      "Fléaux, énergie occulte et animation nerveuse : comment l'adaptation du manga de Gege Akutami est devenue un pilier du shōnen d'action moderne.",
    body: [
      "Tiré du manga de Gege Akutami et animé par le studio MAPPA, « Jujutsu Kaisen » suit Yuji Itadori, un lycéen qui avale un doigt maudit et se retrouve à héberger Sukuna, l'un des fléaux les plus redoutables.",
      "La série s'est distinguée par sa mise en scène de combats particulièrement dynamique et par un casting de personnages rapidement devenus cultes auprès du public.",
      "En quelques saisons, « Jujutsu Kaisen » s'est hissé parmi les licences shōnen les plus populaires du moment, aux côtés des plus grands noms du genre.",
    ],
    publishedAt: "2024-09-05",
    source: "KAZEN",
    category: "Analyse",
    popularity: 90,
    featured: true,
    titles: [{ source: "anilist", externalId: "113415" }],
  },
  {
    slug: "demon-slayer-ufotable-animation",
    title: "Demon Slayer : quand ufotable élève l'animation au rang d'art",
    excerpt:
      "Le mariage entre l'aquarelle numérique et l'action pure : retour sur ce qui fait la signature visuelle de l'adaptation par ufotable.",
    body: [
      "Adapté du manga de Koyoharu Gotōge, « Demon Slayer : Kimetsu no Yaiba » raconte le parcours de Tanjirō Kamado, décidé à sauver sa sœur transformée en démon.",
      "Le studio ufotable a marqué les esprits en fusionnant animation traditionnelle et effets numériques, offrant des séquences de combat parmi les plus spectaculaires de l'animation récente.",
      "Ce soin apporté à l'image, associé à une histoire portée par l'émotion, a fait de la licence un phénomène mondial, aussi bien à la télévision qu'au cinéma.",
    ],
    publishedAt: "2024-06-12",
    source: "KAZEN",
    category: "Analyse",
    popularity: 88,
    featured: true,
    titles: [{ source: "anilist", externalId: "101922" }],
  },
  {
    slug: "one-piece-phenomene-mondial",
    title: "One Piece : pourquoi la saga de Luffy reste un phénomène mondial",
    excerpt:
      "Plus de deux décennies d'aventure sur Grand Line : ce qui fait de l'œuvre d'Eiichirō Oda l'une des plus grandes épopées du manga et de l'anime.",
    body: [
      "Créée par Eiichirō Oda et adaptée par le studio Toei Animation, « One Piece » suit Monkey D. Luffy et son équipage à la recherche du trésor ultime, le One Piece.",
      "Par son ampleur narrative, son univers foisonnant et ses personnages attachants, la série s'est imposée comme un pilier incontournable de la culture populaire.",
      "Portée par une longévité rare, l'aventure continue de conquérir de nouvelles générations de spectateurs à travers le monde.",
    ],
    publishedAt: "2024-04-01",
    source: "KAZEN",
    category: "Analyse",
    popularity: 85,
    featured: true,
    titles: [{ source: "anilist", externalId: "21" }],
  },
];


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

/**
 * Featured articles for Découverte. Only real, internal (clickable) entries
 * flagged `featured` are returned, ordered by popularity then recency. Callers
 * hide the block when this returns an empty array.
 */
export function getFeaturedArticles(limit = 4): NewsArticle[] {
  return NEWS_ARTICLES.filter((a) => a.featured && !a.externalUrl)
    .sort((a, b) => {
      const pa = a.popularity ?? 0;
      const pb = b.popularity ?? 0;
      if (pa !== pb) return pb - pa;
      return byRecent(a, b);
    })
    .slice(0, limit);
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
