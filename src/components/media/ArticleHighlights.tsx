import { Link } from "@tanstack/react-router";
import { Newspaper, ArrowUpRight } from "lucide-react";
import { getDiscoverArticles } from "@/lib/news";

/**
 * Découverte "Actualités KAZEN" block.
 *
 * Renders only real, internal, featured articles from the KAZEN editorial
 * registry. If none exist, the whole block is hidden — never a placeholder or
 * a dead-end card. Every card links to a real /actualites/$slug page.
 */
export function ArticleHighlights() {
  const articles = getFeaturedArticles(4);
  if (!articles.length) return null;

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

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

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {articles.map((a) => {
          const when = !Number.isNaN(new Date(a.publishedAt).getTime())
            ? dateFmt.format(new Date(a.publishedAt))
            : null;
          return (
            <li key={a.slug}>
              <Link
                to="/actualites/$slug"
                params={{ slug: a.slug }}
                className="focus-ring hover-lift group flex h-full flex-col gap-2 rounded-2xl border border-border bg-card/60 p-4 backdrop-blur transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {a.category ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
                      {a.category}
                    </span>
                  ) : null}
                  {when ? <span>{when}</span> : null}
                  <ArrowUpRight className="ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="line-clamp-3 text-sm font-semibold leading-snug">{a.title}</p>
                <p className="line-clamp-3 text-xs text-muted-foreground">{a.excerpt}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
