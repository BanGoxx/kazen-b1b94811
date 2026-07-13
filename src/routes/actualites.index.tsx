import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Newspaper, ArrowUpRight, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  getAllArticles,
  getArticleCategories,
  getFeaturedArticles,
  type NewsArticle,
} from "@/lib/news";

export const Route = createFileRoute("/actualites/")({
  head: () => ({
    meta: [
      { title: "Actualités & analyses — KAZEN" },
      {
        name: "description",
        content:
          "Analyses éditoriales KAZEN sur les anime, séries et films : décryptages, contextes et sélections curées. Jamais un fil d'actu bruité.",
      },
      { property: "og:title", content: "Actualités & analyses — KAZEN" },
      {
        property: "og:description",
        content:
          "Décryptages et analyses éditoriales KAZEN sur les anime, séries et films.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActualitesIndex,
  errorComponent: () => (
    <AppShell>
      <div className="mx-auto max-w-2xl py-16 text-center text-sm text-muted-foreground">
        Impossible de charger les actualités pour le moment.
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="mx-auto max-w-2xl py-16 text-center text-sm text-muted-foreground">
        Page introuvable.
      </div>
    </AppShell>
  ),
});

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function metaLabel(a: NewsArticle): string {
  const category = a.category ?? "Analyse";
  if (a.evergreen) return category;
  const t = new Date(a.publishedAt).getTime();
  if (Number.isNaN(t)) return category;
  return `${category} · ${dateFmt.format(new Date(t))}`;
}

function ActualitesIndex() {
  const all = useMemo(() => getAllArticles(), []);
  const featured = useMemo(() => getFeaturedArticles(3), []);
  const categories = useMemo(() => getArticleCategories(), []);
  const [active, setActive] = useState<string | null>(null);

  const featuredSlugs = useMemo(
    () => new Set(featured.map((a) => a.slug)),
    [featured],
  );

  const rest = useMemo(
    () =>
      all.filter((a) => {
        if (featuredSlugs.has(a.slug)) return false;
        if (active && (a.category ?? "Analyse") !== active) return false;
        return true;
      }),
    [all, featuredSlugs, active],
  );

  const empty = all.length === 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold">
            <Newspaper className="h-7 w-7 text-primary" />
            Actualités & analyses
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Des décryptages curés sur l'univers anime, séries et films — une
            sélection éditoriale, jamais un fil d'actu bruité.
          </p>
        </header>

        {empty ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Aucun article disponible pour le moment.
          </p>
        ) : (
          <>
            {featured.length > 0 && !active && (
              <section aria-labelledby="une" className="mb-10">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 id="une" className="font-display text-lg font-bold">
                    À la une
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {featured.map((a, i) => (
                    <Link
                      key={a.slug}
                      to="/actualites/$slug"
                      params={{ slug: a.slug }}
                      className={`focus-ring group flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur transition-colors hover:border-primary/40 ${
                        i === 0 ? "sm:col-span-2 lg:col-span-1" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
                          {metaLabel(a)}
                        </span>
                        <ArrowUpRight className="ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <p className="font-display text-lg font-bold leading-snug">
                        {a.title}
                      </p>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {a.excerpt}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {categories.length > 1 && (
              <div className="mb-6 flex flex-wrap gap-2">
                <FilterChip
                  label="Tout"
                  active={active === null}
                  onClick={() => setActive(null)}
                />
                {categories.map((c) => (
                  <FilterChip
                    key={c}
                    label={c}
                    active={active === c}
                    onClick={() => setActive(c)}
                  />
                ))}
              </div>
            )}

            <section aria-label="Tous les articles">
              {rest.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Aucun article dans cette catégorie.
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {rest.map((a) => (
                    <li key={a.slug}>
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
                        <p className="line-clamp-2 text-sm font-semibold leading-snug">
                          {a.title}
                        </p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {a.excerpt}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "aurora" : "outline"}
      size="sm"
      className="rounded-full"
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
