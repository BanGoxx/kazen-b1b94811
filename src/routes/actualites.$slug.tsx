import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Newspaper } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { getArticleBySlug, type ArticleBlock, type NewsArticle } from "@/lib/news";

/**
 * KAZEN article / news detail.
 *
 * French-first, premium editorial layout for title-scoped articles. Content
 * comes from the validated registry in `src/lib/news.ts` — when no article
 * matches the slug we render a graceful not-found instead of fabricated
 * content. Every article links back to the titles it covers and to Découverte
 * to keep internal KAZEN navigation first.
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
          ? [
              { property: "og:image", content: article.thumbnailUrl },
              { name: "twitter:image", content: article.thumbnailUrl },
            ]
          : []),
      ],
    };
  },
  component: ArticlePage,
  notFoundComponent: ArticleNotFound,
});

function ArticlePage() {
  const { article } = Route.useLoaderData();
  const when = formatFr(article.publishedAt);
  const primary = article.titles[0] ?? null;

  return (
    <AppShell>
      <article className="mx-auto max-w-2xl py-6 sm:py-10">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link to="/">
            <ArrowLeft className="mr-1 h-4 w-4" /> Retour à la découverte
          </Link>
        </Button>

        {/* Hero / title area */}
        <header className="border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {article.category ? (
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-medium text-primary">
                {article.category}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 font-medium">
              <Newspaper className="h-3.5 w-3.5" /> {article.source}
            </span>
            {when ? <span aria-hidden>·</span> : null}
            {when ? <time dateTime={article.publishedAt}>{when}</time> : null}
          </div>

          <h1 className="mt-3 font-display text-2xl font-bold leading-tight sm:text-4xl">
            {article.title}
          </h1>

          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            {article.excerpt}
          </p>
        </header>

        {article.thumbnailUrl ? (
          <div className="mt-6 aspect-video overflow-hidden rounded-2xl border border-border bg-muted/40">
            <img
              src={article.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        {/* Body */}
        <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-foreground/90 sm:text-base">
          {article.blocks.map((block: ArticleBlock, i: number) => (
            <ArticleBlockView key={i} block={block} />
          ))}
        </div>

        <TitleLinks article={article} />

        {/* Footer navigation */}
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
          {primary ? (
            <Button asChild size="sm">
              <Link
                to="/media/$source/$id"
                params={{ source: primary.source, id: primary.externalId }}
              >
                Voir la fiche <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" /> Découverte
            </Link>
          </Button>
        </div>
      </article>
    </AppShell>
  );
}

function ArticleBlockView({ block }: { block: ArticleBlock }) {
  if (block.kind === "heading") {
    return (
      <h2 className="pt-2 font-display text-lg font-bold sm:text-xl">
        {block.text}
      </h2>
    );
  }
  if (block.kind === "quote") {
    return (
      <blockquote className="border-l-2 border-primary/60 pl-4 italic text-foreground/80">
        {block.text}
      </blockquote>
    );
  }
  return <p>{block.text}</p>;
}

function TitleLinks({ article }: { article: NewsArticle }) {
  if (article.titles.length <= 1) return null;
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

function formatFr(iso: string): string | null {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
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
