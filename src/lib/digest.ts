// KAZEN digest builder — Phase 1 (foundation & preview only).
//
// Pure, deterministic, side-effect-free. It turns already-fetched discovery
// data + the member's taste signals into a structured, email-safe digest
// model that the preview UI renders. It NEVER fetches, sends, or schedules.
//
// Provider resilience is by construction: every section is built from arrays
// that may be empty (a failed provider simply yields []), and empty sections
// are dropped so the preview never shows a fake-empty digest or hangs.

import type { MediaItem } from "./media-types";
import type { NewsArticle } from "./news";
import type { TasteProfile } from "./recommend";
import type { EmailPreferences } from "./email-prefs.functions";

const SITE_URL = "https://kazen.lovable.app";

export interface DigestMediaRef {
  key: string;
  title: string;
  source: string;
  externalId: string;
  mediaType: MediaItem["mediaType"];
  releaseDate: string | null;
  posterUrl: string | null;
  score: number | null;
  href: string;
  reason?: string;
}

export interface DigestArticleRef {
  slug: string;
  title: string;
  excerpt: string;
  href: string;
  publishedAt: string;
  evergreen: boolean;
}

export interface DigestSection {
  id: string;
  title: string;
  kind: "media" | "article";
  media?: DigestMediaRef[];
  articles?: DigestArticleRef[];
}

export interface DigestModel {
  variant: "general" | "personalized";
  subject: string;
  preheader: string;
  heading: string;
  intro: string;
  sections: DigestSection[];
  cta: { label: string; href: string };
  footerNote: string;
  managePreferencesHref: string;
  unsubscribeHref: string;
  isEmpty: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mediaHref(item: MediaItem): string {
  return `${SITE_URL}/media/${item.source}/${item.externalId}`;
}

function toRef(item: MediaItem, reason?: string): DigestMediaRef {
  return {
    key: item.key,
    title: item.title,
    source: item.source,
    externalId: item.externalId,
    mediaType: item.mediaType,
    releaseDate: item.releaseDate,
    posterUrl: item.posterUrl,
    score: item.score,
    href: mediaHref(item),
    reason,
  };
}

function articleRef(a: NewsArticle): DigestArticleRef {
  return {
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    href: `${SITE_URL}/actualites/${a.slug}`,
    publishedAt: a.publishedAt,
    evergreen: a.evergreen,
  };
}

/** Dedup by media key, drop items without a poster, bound the count. */
function boundMedia(items: MediaItem[], limit: number, seen: Set<string>): MediaItem[] {
  const out: MediaItem[] = [];
  for (const it of items) {
    if (!it || !it.key || seen.has(it.key)) continue;
    seen.add(it.key);
    out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

function byReleaseDate(a: MediaItem, b: MediaItem): number {
  const ta = a.releaseDate ? new Date(a.releaseDate).getTime() : Infinity;
  const tb = b.releaseDate ? new Date(b.releaseDate).getTime() : Infinity;
  return ta - tb;
}

/** Content-type preference mapping (UI uses "films"; MediaItem uses "movie"). */
function typeAllowed(item: MediaItem, prefs?: EmailPreferences): boolean {
  const types = prefs?.preferred_content_types;
  if (!types || types.length === 0) return true;
  const map: Record<MediaItem["mediaType"], string> = {
    anime: "anime",
    movie: "films",
    series: "series",
  };
  return types.includes(map[item.mediaType]);
}

/** Whether the "articles" content-type is selected (empty selection = all). */
function articlesAllowed(prefs?: EmailPreferences): boolean {
  const types = prefs?.preferred_content_types;
  if (!types || types.length === 0) return true;
  return types.includes("articles");
}

// ---------------------------------------------------------------------------
// General digest
// ---------------------------------------------------------------------------

export interface GeneralDigestInput {
  upcomingAnime: MediaItem[];
  upcomingMovies: MediaItem[];
  /** Currently-airing series (on-air pool), not an upcoming feed. */
  onAirSeries: MediaItem[];
  trending: MediaItem[];
  articles: NewsArticle[];
  prefs?: EmailPreferences;
}

const GENERAL_LIMITS = { anime: 4, movies: 3, series: 3, trending: 4, articles: 4 };

export function buildGeneralDigest(input: GeneralDigestInput): DigestModel {
  const prefs = input.prefs;
  const includeUpcoming = prefs?.include_upcoming ?? true;
  const includeArticles = prefs?.include_articles ?? true;
  const seen = new Set<string>();
  const sections: DigestSection[] = [];

  const pushMedia = (id: string, title: string, items: MediaItem[]) => {
    const refs = items.filter((i) => typeAllowed(i, prefs)).map((i) => toRef(i));
    if (refs.length) sections.push({ id, title, kind: "media", media: refs });
  };

  if (includeUpcoming) {
    pushMedia(
      "upcoming-anime",
      "Anime à venir",
      boundMedia([...input.upcomingAnime].sort(byReleaseDate), GENERAL_LIMITS.anime, seen),
    );
    pushMedia(
      "upcoming-movies",
      "Films à venir",
      boundMedia([...input.upcomingMovies].sort(byReleaseDate), GENERAL_LIMITS.movies, seen),
    );
    // NOTE: the series source is the "on-air" pool (currently airing), NOT an
    // upcoming/announced feed. Keep the label honest and preserve the source's
    // popularity ordering rather than sorting by release date.
    pushMedia(
      "onair-series",
      "Séries en diffusion",
      boundMedia(input.onAirSeries, GENERAL_LIMITS.series, seen),
    );
  }

  pushMedia("trending", "Tendances du moment", boundMedia(input.trending, GENERAL_LIMITS.trending, seen));

  if (includeArticles && articlesAllowed(prefs) && input.articles.length) {
    const articles = input.articles.slice(0, GENERAL_LIMITS.articles).map(articleRef);
    if (articles.length)
      sections.push({ id: "articles", title: "Actualités récentes", kind: "article", articles });
  }

  return {
    variant: "general",
    subject: "Cette semaine sur KAZEN : sorties, tendances et actualités",
    preheader: "Les nouveautés anime, films et séries à ne pas manquer.",
    heading: "Cette semaine sur KAZEN",
    intro:
      "Un aperçu des sorties à venir, des titres tendance et des dernières analyses de la rédaction KAZEN.",
    sections,
    cta: { label: "Découvrir sur KAZEN", href: `${SITE_URL}/` },
    footerNote:
      "Vous recevez cet aperçu parce que vous avez activé le digest général KAZEN. Aucun email n'est envoyé sans votre accord.",
    managePreferencesHref: `${SITE_URL}/profil`,
    unsubscribeHref: `${SITE_URL}/profil`,
    isEmpty: sections.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Personalized "Pour vous" digest
// ---------------------------------------------------------------------------

export interface PersonalizedDigestInput {
  /** Ranked "for you" items (already excludes saved). */
  recommendations: { item: MediaItem; reasonGenres: string[] }[];
  /** Fresh/upcoming items matching taste. */
  freshForYou: MediaItem[];
  /** Titles the member is currently watching, to resume. */
  inProgress: MediaItem[];
  /** Titles the member planned to watch. */
  planned: MediaItem[];
  /** Articles related to titles the member follows. */
  relatedArticles: NewsArticle[];
  profile: TasteProfile;
  prefs?: EmailPreferences;
}

const PERSONAL_LIMITS = { recos: 4, fresh: 3, resume: 3, planned: 3, articles: 3 };

export function buildPersonalizedDigest(input: PersonalizedDigestInput): DigestModel {
  const { profile, prefs } = input;
  const includeRecommendations = prefs?.include_recommendations ?? true;
  const includeUpcoming = prefs?.include_upcoming ?? true;
  const includeArticles = prefs?.include_articles ?? true;
  const seen = new Set<string>();
  const sections: DigestSection[] = [];

  // Currently watching → "Reprendre votre progression"
  const resume = boundMedia(input.inProgress, PERSONAL_LIMITS.resume, seen)
    .filter((i) => typeAllowed(i, prefs))
    .map((i) => toRef(i, "Vous avez commencé ce titre"));
  if (resume.length)
    sections.push({ id: "resume", title: "Reprendre votre progression", kind: "media", media: resume });

  if (includeRecommendations) {
    const recos = input.recommendations
      .filter((r) => typeAllowed(r.item, prefs) && !seen.has(r.item.key))
      .slice(0, PERSONAL_LIMITS.recos)
      .map((r) => {
        seen.add(r.item.key);
        const reason = r.reasonGenres.length
          ? `Parce que vous aimez ${r.reasonGenres.join(", ")}`
          : "Recommandé selon vos goûts";
        return toRef(r.item, reason);
      });
    if (recos.length)
      sections.push({ id: "recos", title: "Parce que vous avez aimé…", kind: "media", media: recos });
  }

  if (includeUpcoming) {
    const fresh = boundMedia(input.freshForYou, PERSONAL_LIMITS.fresh, seen)
      .filter((i) => typeAllowed(i, prefs))
      .map((i) => toRef(i, "Nouvelle sortie dans vos genres"));
    if (fresh.length)
      sections.push({ id: "fresh", title: "Nouvelles sorties dans vos genres", kind: "media", media: fresh });
  }

  const planned = boundMedia(input.planned, PERSONAL_LIMITS.planned, seen)
    .filter((i) => typeAllowed(i, prefs))
    .map((i) => toRef(i, "Dans votre liste « à voir »"));
  if (planned.length)
    sections.push({ id: "planned", title: "À suivre prochainement", kind: "media", media: planned });

  if (includeArticles && articlesAllowed(prefs) && input.relatedArticles.length) {
    const articles = input.relatedArticles.slice(0, PERSONAL_LIMITS.articles).map(articleRef);
    if (articles.length)
      sections.push({ id: "related-articles", title: "Articles liés à vos anime", kind: "article", articles });
  }

  const personalized = profile.signalCount > 0;
  return {
    variant: "personalized",
    subject: "Votre sélection KAZEN de la semaine",
    preheader: personalized
      ? "Des recommandations adaptées à vos goûts."
      : "Commencez à suivre des titres pour personnaliser vos recommandations.",
    heading: "Votre sélection KAZEN",
    intro: personalized
      ? "Une sélection construite à partir de vos titres, notes et genres préférés."
      : "Ajoutez des titres à vos listes pour affiner ces recommandations au fil du temps.",
    sections,
    cta: { label: "Voir « Pour vous »", href: `${SITE_URL}/pour-vous` },
    footerNote:
      "Vous recevez cet aperçu parce que vous avez activé votre digest personnalisé. Aucun email n'est envoyé sans votre accord.",
    managePreferencesHref: `${SITE_URL}/profil`,
    unsubscribeHref: `${SITE_URL}/profil`,
    isEmpty: sections.length === 0,
  };
}
