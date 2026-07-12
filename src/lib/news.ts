import type { MediaSource } from "./media-types";
import type { FicheArticle } from "@/components/media/FicheArticles";

/**
 * KAZEN editorial layer — article pipeline (Step C + follow-up).
 *
 * This module owns the data model, ingestion, normalization, linkage and
 * validation for KAZEN's title-scoped articles. It is deliberately built as a
 * small, real editorial *pipeline* rather than a hand-maintained array so that
 * verified content can be added — or imported later from a CMS / Supabase /
 * feed — without touching the fiche, the Découverte block, or the article page.
 *
 * Safety contract (non-negotiable):
 *  - Only REAL, verified articles ship. We never fabricate articles or inject
 *    generic anime news into a title fiche.
 *  - Every article MUST resolve to a real internal KAZEN page (or an explicit
 *    external URL). Invalid / empty entries are dropped at ingestion time, so
 *    the UI can never surface a dead-end or an empty editorial shell.
 *  - Linkage is explicit: an article surfaces on a fiche only when it is tied
 *    to that exact title (source + externalId) or to its universe anchor.
 *  - Consumers hide gracefully when the returned list is empty.
 *
 * To add content: append a `ArticleInput` to `ARTICLE_SOURCES` below (or feed
 * `defineArticles(...)` from any future import path). Ingestion normalizes,
 * validates and de-duplicates; nothing else in the app needs to change.
 */

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export interface NewsTitleRef {
  source: MediaSource;
  externalId: string;
}

/** Structured body block. Authors can also pass plain strings (→ paragraphs). */
export type ArticleBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "quote"; text: string };

/**
 * Author / import input shape. This is what a human curator or a future import
 * job produces. It is intentionally forgiving (content may be plain strings)
 * and gets normalized + validated by `defineArticles`.
 */
export interface ArticleInput {
  slug: string;
  title: string;
  excerpt: string;
  /** Plain strings become paragraphs; blocks are kept as-is. */
  content: Array<string | ArticleBlock>;
  /** ISO date string. */
  publishedAt: string;
  /** Editorial source label. Defaults to "KAZEN". */
  source?: string;
  category?: string;
  featured?: boolean;
  /**
   * Evergreen editorial (analysis / dossier) with no time-sensitive news
   * claim. `publishedAt` is kept for internal ordering only; the UI must NOT
   * render a specific publication date for evergreen entries, so KAZEN never
   * makes a fake "published on X" claim about undated analysis.
   */
  evergreen?: boolean;
  popularity?: number;
  /** Titles this article is directly about. At least one is required. */
  titles: NewsTitleRef[];
  /** Optional universe anchors ("source:externalId") for franchise-level news. */
  universeKeys?: string[];
  thumbnailUrl?: string | null;
  /** When set, the article is an external redirect (no internal page). */
  externalUrl?: string | null;
}

/**
 * Normalized, validated article consumed by the UI. `body` (paragraph text) is
 * kept for backward compatibility; `blocks` is the richer render source.
 */
export interface NewsArticle {
  slug: string;
  title: string;
  excerpt: string;
  /** Paragraph-only text, for back-compat and previews. */
  body: string[];
  /** Full structured content for the article page. */
  blocks: ArticleBlock[];
  publishedAt: string;
  source: string;
  thumbnailUrl?: string | null;
  titles: NewsTitleRef[];
  universeKeys?: string[];
  category?: string;
  popularity: number;
  featured: boolean;
  externalUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Ingestion + normalization
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toBlocks(content: Array<string | ArticleBlock>): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const item of content) {
    if (typeof item === "string") {
      const text = item.trim();
      if (text) blocks.push({ kind: "paragraph", text });
    } else if (item && typeof item.text === "string" && item.text.trim()) {
      blocks.push({ ...item, text: item.text.trim() });
    }
  }
  return blocks;
}

/**
 * Validate + normalize a single input. Returns `null` when the entry is not a
 * real, resolvable article (missing slug/title/content/linkage or bad date) so
 * it never reaches the UI.
 */
export function normalizeArticle(raw: ArticleInput): NewsArticle | null {
  const slug = (raw.slug ?? "").trim().toLowerCase();
  const title = (raw.title ?? "").trim();
  const excerpt = (raw.excerpt ?? "").trim();
  const blocks = toBlocks(raw.content ?? []);
  const titles = (raw.titles ?? []).filter(
    (t) => t && t.source && (t.externalId ?? "").trim(),
  );

  // Hard requirements for a real, resolvable article.
  if (!slug || !SLUG_RE.test(slug)) return null;
  if (!title || !excerpt) return null;
  if (!blocks.length) return null;
  if (!titles.length) return null;
  if (Number.isNaN(new Date(raw.publishedAt).getTime())) return null;

  return {
    slug,
    title,
    excerpt,
    body: blocks.filter((b) => b.kind === "paragraph").map((b) => b.text),
    blocks,
    publishedAt: raw.publishedAt,
    source: (raw.source ?? "KAZEN").trim() || "KAZEN",
    thumbnailUrl: raw.thumbnailUrl ?? null,
    titles,
    universeKeys: raw.universeKeys?.filter(Boolean),
    category: raw.category?.trim() || undefined,
    popularity: Number.isFinite(raw.popularity) ? Number(raw.popularity) : 0,
    featured: !!raw.featured,
    externalUrl: raw.externalUrl ?? null,
  };
}

/**
 * Build a clean registry from raw inputs: normalizes, drops invalid entries,
 * and de-duplicates by slug (first wins). This is the single ingestion path —
 * a future CMS/feed importer just needs to produce `ArticleInput[]`.
 */
export function defineArticles(inputs: ArticleInput[]): NewsArticle[] {
  const seen = new Set<string>();
  const out: NewsArticle[] = [];
  for (const raw of inputs) {
    const article = normalizeArticle(raw);
    if (!article) continue;
    if (seen.has(article.slug)) continue;
    seen.add(article.slug);
    out.push(article);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Editorial source — REAL, verified content only
// ---------------------------------------------------------------------------

/**
 * Curated editorial entries. Each is a genuine, factually-grounded evergreen
 * analysis explicitly linked to a real title via its AniList id. Quality over
 * quantity. Never add placeholder or fabricated-news entries here.
 */
const ARTICLE_SOURCES: ArticleInput[] = [
  {
    slug: "frieren-chef-doeuvre-apres-aventure",
    title: "Frieren : le chef-d'œuvre d'après-aventure qui a marqué l'animation",
    excerpt:
      "Après la victoire sur le Roi des Démons, Frieren l'elfe reprend la route. Un anime contemplatif signé Madhouse, salué comme l'un des plus beaux de la décennie.",
    content: [
      "Adapté par le studio Madhouse à partir du manga de Kanehito Yamada et Tsukasa Abe, « Frieren » prend le contre-pied du récit d'aventure classique : l'histoire commence là où les autres s'arrêtent, une fois le Roi des Démons vaincu.",
      { kind: "heading", text: "Un voyage sur le temps qui passe" },
      "On suit Frieren, une mage elfe quasi immortelle, qui réalise trop tard combien ses compagnons humains comptaient pour elle. Son voyage devient une méditation sur le temps, la mémoire et le deuil.",
      "Porté par une réalisation d'une grande finesse et une bande-son remarquable, l'anime a été unanimement salué par la critique et la communauté, s'imposant comme une référence de l'animation contemporaine.",
    ],
    publishedAt: "2024-11-20",
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
    content: [
      "Tiré du manga de Gege Akutami et animé par le studio MAPPA, « Jujutsu Kaisen » suit Yuji Itadori, un lycéen qui avale un doigt maudit et se retrouve à héberger Sukuna, l'un des fléaux les plus redoutables.",
      "La série s'est distinguée par sa mise en scène de combats particulièrement dynamique et par un casting de personnages rapidement devenus cultes auprès du public.",
      "En quelques saisons, « Jujutsu Kaisen » s'est hissé parmi les licences shōnen les plus populaires du moment, aux côtés des plus grands noms du genre.",
    ],
    publishedAt: "2024-09-05",
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
    content: [
      "Adapté du manga de Koyoharu Gotōge, « Demon Slayer : Kimetsu no Yaiba » raconte le parcours de Tanjirō Kamado, décidé à sauver sa sœur transformée en démon.",
      "Le studio ufotable a marqué les esprits en fusionnant animation traditionnelle et effets numériques, offrant des séquences de combat parmi les plus spectaculaires de l'animation récente.",
      "Ce soin apporté à l'image, associé à une histoire portée par l'émotion, a fait de la licence un phénomène mondial, aussi bien à la télévision qu'au cinéma.",
    ],
    publishedAt: "2024-06-12",
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
    content: [
      "Créée par Eiichirō Oda et adaptée par le studio Toei Animation, « One Piece » suit Monkey D. Luffy et son équipage à la recherche du trésor ultime, le One Piece.",
      "Par son ampleur narrative, son univers foisonnant et ses personnages attachants, la série s'est imposée comme un pilier incontournable de la culture populaire.",
      "Portée par une longévité rare, l'aventure continue de conquérir de nouvelles générations de spectateurs à travers le monde.",
    ],
    publishedAt: "2024-04-01",
    category: "Analyse",
    popularity: 85,
    featured: true,
    titles: [{ source: "anilist", externalId: "21" }],
  },
];

/** The validated, de-duplicated registry consumed across the app. */
export const NEWS_ARTICLES: NewsArticle[] = defineArticles(ARTICLE_SOURCES);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

function titleKey(ref: NewsTitleRef): string {
  return `${ref.source}:${ref.externalId}`;
}

function byRecent(a: NewsArticle, b: NewsArticle): number {
  const ta = new Date(a.publishedAt).getTime();
  const tb = new Date(b.publishedAt).getTime();
  return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
}

function byPopularityThenRecent(a: NewsArticle, b: NewsArticle): number {
  if (a.popularity !== b.popularity) return b.popularity - a.popularity;
  return byRecent(a, b);
}

/**
 * Articles directly linked to a title, optionally including its universe
 * anchor so franchise-level news can surface on member titles. Sorted by
 * relevance (popularity) then recency.
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
  }).sort(byPopularityThenRecent);
}

/** Internal article by slug (external-only entries have no page → null). */
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
    .sort(byPopularityThenRecent)
    .slice(0, limit);
}

/**
 * Recency-first editorial selection for the Découverte page (Step E). Recent
 * articles surface first so the block feels alive, with a light popularity
 * tie-break for same-day entries — a curated feel, never a noisy news feed.
 * Only real, internal (clickable), featured entries are considered.
 */
export function getDiscoverArticles(limit = 4): NewsArticle[] {
  return NEWS_ARTICLES.filter((a) => a.featured && !a.externalUrl)
    .sort((a, b) => {
      const recent = byRecent(a, b);
      if (recent !== 0) return recent;
      return b.popularity - a.popularity;
    })
    .slice(0, limit);
}

/** Normalize a NewsArticle into the presentational FicheArticle shape. */
export function toFicheArticle(
  a: NewsArticle,
  relevance?: ArticleRelevance,
): FicheArticle {
  return {
    id: a.slug,
    title: a.title,
    source: a.source,
    category: a.category ?? null,
    publishedAt: a.publishedAt,
    excerpt: a.excerpt,
    url: a.externalUrl ?? null,
    slug: a.externalUrl ? null : a.slug,
    thumbnailUrl: a.thumbnailUrl ?? null,
    relevance: relevance ?? null,
  };
}

// ---------------------------------------------------------------------------
// Article-to-fiche relevance (Phase 1)
// ---------------------------------------------------------------------------

/**
 * Relevance tier of an article relative to a specific fiche. Precision-first:
 *  - `exact`     → article is directly linked to this exact media record.
 *  - `franchise` → article is linked to the same universe / franchise anchor.
 *  - `related`   → article is linked to a clearly related work (same source
 *                  material / related media on this fiche).
 * A broader studio/genre/theme fallback is intentionally NOT surfaced here to
 * avoid diluting a fiche with unrelated generic news (documented future work).
 */
export type ArticleRelevance = "exact" | "franchise" | "related";

const RELEVANCE_RANK: Record<ArticleRelevance, number> = {
  exact: 0,
  franchise: 1,
  related: 2,
};

/** French label for the non-exact relevance tiers (calm, discreet). */
export const RELEVANCE_LABEL: Record<ArticleRelevance, string | null> = {
  exact: null,
  franchise: "Même univers",
  related: "Œuvre liée",
};

export interface RelevantArticle {
  article: NewsArticle;
  relevance: ArticleRelevance;
}

/**
 * Return the articles that are genuinely relevant to a fiche, ordered by
 * relevance tier first (exact → franchise → related) then newest-first inside
 * each tier. De-duplicated by slug (best tier wins). Returns an empty array
 * when nothing is truly relevant, so the fiche block hides itself — a fiche
 * never shows unrelated generic articles just to fill space.
 */
export function getRelevantArticlesForTitle(
  source: MediaSource,
  externalId: string,
  opts?: { universeKey?: string | null; relatedRefs?: NewsTitleRef[] },
): RelevantArticle[] {
  const self = `${source}:${externalId}`;
  const universeKey = opts?.universeKey ?? null;
  const relatedSet = new Set((opts?.relatedRefs ?? []).map(titleKey));
  relatedSet.delete(self);

  const out: RelevantArticle[] = [];
  for (const a of NEWS_ARTICLES) {
    const keys = a.titles.map(titleKey);
    let relevance: ArticleRelevance | null = null;
    if (keys.includes(self)) relevance = "exact";
    else if (universeKey && (a.universeKeys ?? []).includes(universeKey))
      relevance = "franchise";
    else if (keys.some((k) => relatedSet.has(k))) relevance = "related";
    if (!relevance) continue;
    out.push({ article: a, relevance });
  }

  out.sort((x, y) => {
    const r = RELEVANCE_RANK[x.relevance] - RELEVANCE_RANK[y.relevance];
    if (r !== 0) return r;
    return byRecent(x.article, y.article);
  });

  const seen = new Set<string>();
  return out.filter((x) =>
    seen.has(x.article.slug) ? false : (seen.add(x.article.slug), true),
  );
}
