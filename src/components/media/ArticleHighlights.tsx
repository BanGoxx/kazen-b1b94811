import { Link } from "@tanstack/react-router";
import { Newspaper, ArrowUpRight } from "lucide-react";
import { getDiscoverArticles, type NewsArticle } from "@/lib/news";

/**
 * Découverte "Actualités KAZEN" block.
 *
 * Renders only real, internal, featured articles from the KAZEN editorial
 * registry. If none exist, the whole block is hidden — never a placeholder or
 * a dead-end card. Every card links to a real /actualites/$slug page.
 *
 * Layout: a prominent lead article beside a compact side list. This richer
 * editorial layout is intentionally applied only now that real articles
 * exist; with a single entry it degrades gracefully to just the lead card.
 * Evergreen analyses never render a specific publication date (no fake
 * "published on X" claim) — they show their editorial format instead.
 */
export function ArticleHighlights() {
  const articles = getDiscoverArticles(4);
  if (!articles.length) return null;

  const [lead, ...rest] = articles;

  return (
    <section aria-labelledby="actus-kazen">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          <h2 id="actus-kazen" className="font-display text-xl font-bold sm:text-2xl">
            Actualités KAZEN
          </h2>
        </div>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Analyses et éclairages sur vos titres
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <LeadArticle article={lead} />
        {rest.length ? (
          <ul className="flex flex-col gap-3">
            {rest.map((a) => (
              <li key={a.slug}>
                <SideArticle article={a} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/** Format label shown in place of a date for evergreen editorial. */
function metaLabel(a: NewsArticle): string {
  return a.category ?? "Analyse";
}

function LeadArticle({ article: a }: { article: NewsArticle }) {
  return (
    <Link
      to="/actualites/$slug"
      params={{ slug: a.slug }}
      className="focus-ring hover-lift group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur transition-colors hover:border-primary/40"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
          {metaLabel(a)}
        </span>
        <span className="font-medium">À la une</span>
        <ArrowUpRight className="ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p className="font-display text-lg font-bold leading-snug sm:text-xl">{a.title}</p>
      <p className="line-clamp-3 text-sm text-muted-foreground">{a.excerpt}</p>
    </Link>
  );
}

function SideArticle({ article: a }: { article: NewsArticle }) {
  return (
    <Link
      to="/actualites/$slug"
      params={{ slug: a.slug }}
      className="focus-ring group flex h-full flex-col gap-1.5 rounded-2xl border border-border bg-card/60 p-4 backdrop-blur transition-colors hover:border-primary/40"
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
  );
}
