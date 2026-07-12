import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Newspaper } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { getArticleBySlug, type NewsArticle } from "@/lib/news";

/**
 * KAZEN article / news detail (Step C).
 *
 * French-first, premium editorial layout for title-scoped articles. Content
 * comes from the safe registry in `src/lib/news.ts` — when no article matches
 * the slug we render a graceful not-found instead of fabricated content. Each
 * article links back to the titles it covers to keep internal navigation first.
 */
export const Route = createFileRoute("/actualites/$slug")({
  loader: async ({ params }) => {
    const article = getArticleBySlug(params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => {
    const article = loaderData?.article;
    if (!article) {
      return {
        meta: [
          { title: "Actualité — KAZEN" },
          {
            name: "description",
            content: "Actualités autour des anime, séries et films sur KAZEN.",
          },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    return {
      meta: [
        { title: `${article.title} — KAZEN` },
        { name: "description", content: article.excerpt },
        { property: "og:title", content: article.title },
        { property: "og:description", content: article.excerpt },
        { property: "og:type", content: "article" },
        ...(article.thumbnailUrl
          ? [{ property: "og:image", content: article.thumbnailUrl }]
          : []),
      ],
    };
  },
  component: ArticlePage,
  notFoundComponent: ArticleNotFound,
});

function ArticlePage() {
  const { article } = Route.useLoaderData();
  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const when =
    article.publishedAt && !Number.isNaN(new Date(article.publishedAt).getTime())
      ? dateFmt.format(new Date(article.publishedAt))
      : null;

  return (
    <AppShell>
      <article className="mx-auto max-w-2xl py-6 sm:py-10">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link to="/">
            <ArrowLeft className="mr-1 h-4 w-4" /> Retour à la découverte
          </Link>
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            <Newspaper className="h-3.5 w-3.5" /> {article.source}
          </span>
          {when ? <span>· {when}</span> : null}
        </div>

        <h1 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl">
          {article.title}
        </h1>

        {article.thumbnailUrl ? (
          <div className="mt-5 aspect-video overflow-hidden rounded-2xl border border-border bg-muted/40">
            <img
              src={article.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-foreground/90">
          {article.body.map((p: string, i: number) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <TitleLinks article={article} />
      </article>
    </AppShell>
  );
}

function TitleLinks({ article }: { article: NewsArticle }) {
  if (!article.titles.length) return null;
  return (
    <div className="mt-8 border-t border-border pt-6">
      <p className="mb-3 text-sm font-semibold text-muted-foreground">
        Fiches liées
      </p>
      <div className="flex flex-wrap gap-2">
        {article.titles.map((t) => (
          <Button
            key={`${t.source}:${t.externalId}`}
            asChild
            variant="outline"
            size="sm"
          >
            <Link
              to="/media/$source/$id"
              params={{ source: t.source, id: t.externalId }}
            >
              Voir la fiche <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

function ArticleNotFound() {
  return (
    <AppShell>
      <div className="mx-auto max-w-lg py-24 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card/60">
          <Newspaper className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold">Article indisponible</h1>
        <p className="mt-2 text-muted-foreground">
          Cette actualité n'est pas encore disponible sur KAZEN.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">
            <ArrowLeft className="mr-1 h-4 w-4" /> Retour à la découverte
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
