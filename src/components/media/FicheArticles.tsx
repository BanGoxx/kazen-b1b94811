import { useState } from "react";
import { Newspaper, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { FicheSection } from "./FicheSection";

/** Relevance tier of an article relative to the current fiche. */
export type FicheArticleRelevance = "exact" | "franchise" | "related";

const RELEVANCE_TAG: Record<FicheArticleRelevance, string | null> = {
  exact: null,
  franchise: "Même univers",
  related: "Œuvre liée",
};

export interface FicheArticle {
  id: string;
  title: string;
  source: string;
  category?: string | null;
  /** External URL — set for outbound articles. Null for internal KAZEN pages. */
  url?: string | null;
  /** Internal KAZEN article slug (/actualites/$slug). Null for external ones. */
  slug?: string | null;
  publishedAt?: string | null;
  excerpt?: string | null;
  thumbnailUrl?: string | null;
  /** Why this article is shown on this fiche (drives a discreet tag). */
  relevance?: FicheArticleRelevance | null;
}

const VISIBLE_LIMIT = 4;

/**
 * Editorial "actualités liées" block (Article-to-Fiche Relevance, Phase 1).
 *
 * Renders only articles that are truly relevant to this title (the caller
 * already filters + orders them by relevance tier then recency). It shows
 * nothing when the list is empty, so the fiche never displays an empty or
 * broken-looking section. Visible entries are capped; a discreet in-place
 * "Voir toutes les actualités liées" reveals the rest only when more exist.
 * Internal articles route to /actualites/$slug; external ones open cleanly.
 */
export function FicheArticles({
  articles,
  titleLabel,
}: {
  articles: FicheArticle[];
  titleLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!articles.length) return null;

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const hasMore = articles.length > VISIBLE_LIMIT;
  const shown = expanded ? articles : articles.slice(0, VISIBLE_LIMIT);
  const heading = titleLabel
    ? `Actualités liées à ${titleLabel}`
    : "Actualités liées";

  return (
    <FicheSection title={heading} icon={<Newspaper className="h-5 w-5" />}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((a) => {
          const when =
            a.publishedAt && !Number.isNaN(new Date(a.publishedAt).getTime())
              ? dateFmt.format(new Date(a.publishedAt))
              : null;
          const tag =
            a.relevance && a.relevance !== "exact"
              ? RELEVANCE_TAG[a.relevance]
              : null;

          const inner = (
            <>
              {a.thumbnailUrl ? (
                <div className="mb-2 aspect-video overflow-hidden rounded-xl border border-border bg-muted/40">
                  <img
                    src={a.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {a.category ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
                    {a.category}
                  </span>
                ) : (
                  <span className="font-medium text-primary">{a.source}</span>
                )}
                {when ? <span>· {when}</span> : null}
                {tag ? (
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                    {tag}
                  </span>
                ) : null}
                <ArrowUpRight className="ml-auto h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="line-clamp-2 text-sm font-semibold leading-snug">{a.title}</p>
              {a.excerpt ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{a.excerpt}</p>
              ) : null}
            </>
          );

          const className =
            "focus-ring group flex h-full flex-col gap-1 rounded-2xl border border-border bg-card/60 p-4 backdrop-blur transition-colors hover:border-primary/40";

          return (
            <li key={a.id}>
              {a.slug ? (
                <Link to="/actualites/$slug" params={{ slug: a.slug }} className={className}>
                  {inner}
                </Link>
              ) : (
                <a
                  href={a.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  {inner}
                </a>
              )}
            </li>
          );
        })}
      </ul>

      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          {expanded
            ? "Réduire"
            : `Voir toutes les actualités liées (${articles.length})`}
        </button>
      ) : null}
    </FicheSection>
  );
}
