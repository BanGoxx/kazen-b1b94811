import { Link } from "@tanstack/react-router";
import { Newspaper, ArrowUpRight } from "lucide-react";
import { getRecentArticles, type NewsArticle } from "@/lib/news";

/**
 * Découverte "Articles récents" sidebar.
 *
 * Renders only real, internal KAZEN articles (newest first) from the editorial
 * registry — never fabricated news. New entries added to the article source
 * surface here automatically. Hides cleanly when no article exists. Each card
 * links to its internal /actualites/$slug page.
 *
 * This is general recent editorial for discovery only; it never affects the
 * contextual, relevance-scoped article logic shown on media fiches.
 */
const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function metaLabel(a: NewsArticle): string {
  const category = a.category ?? "Analyse";
  // Evergreen analyses never render a specific publication date (no fake
  // "published on X" claim) — the editorial format stands in for the date.
  if (a.evergreen) return category;
  const t = new Date(a.publishedAt).getTime();
  if (Number.isNaN(t)) return category;
  return `${category} · ${dateFmt.format(new Date(t))}`;
}

export function RecentArticles({ limit = 5 }: { limit?: number }) {
  const articles = getRecentArticles(limit);
  if (!articles.length) return null;

  return (
    <section aria-labelledby="articles-recents" className="lg:sticky lg:top-24">
      <div className="mb-4 flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-primary" />
        <h2 id="articles-recents" className="font-display text-lg font-bold">
          Articles récents
        </h2>
      </div>
      <ul className="flex flex-col gap-3">
        {articles.map((a) => (
          <li key={a.slug}>
            <Link
              to="/actualites/$slug"
              params={{ slug: a.slug }}
              className="focus-ring group flex flex-col gap-1.5 rounded-2xl border border-border bg-card/60 p-4 backdrop-blur transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
                  {metaLabel(a)}
                </span>
                <ArrowUpRight className="ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="line-clamp-2 text-sm font-semibold leading-snug">{a.title}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{a.excerpt}</p>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to="/actualites"
        className="focus-ring mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        Toutes les actualités
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
