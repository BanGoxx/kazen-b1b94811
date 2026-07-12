import { Newspaper, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { FicheSection } from "./FicheSection";

export interface FicheArticle {
  id: string;
  title: string;
  source: string;
  /** External URL — set for outbound articles. Null for internal KAZEN pages. */
  url?: string | null;
  /** Internal KAZEN article slug (/actualites/$slug). Null for external ones. */
  slug?: string | null;
  publishedAt?: string | null;
  excerpt?: string | null;
  thumbnailUrl?: string | null;
}

/**
 * Editorial "autour de ce titre" block. Purely presentational and
 * extension-ready: it renders nothing when there is no article to show, so the
 * fiche never displays an empty or broken-looking section. When a safe article
 * source is wired later, pass the normalized list here without redesigning the
 * page. Internal articles route to /actualites/$slug (KAZEN navigation first);
 * external ones open as clean redirects.
 */
export function FicheArticles({ articles }: { articles: FicheArticle[] }) {
  if (!articles.length) return null;

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <FicheSection title="Actualités du titre" icon={<Newspaper className="h-5 w-5" />}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {articles.map((a) => {
          const when =
            a.publishedAt && !Number.isNaN(new Date(a.publishedAt).getTime())
              ? dateFmt.format(new Date(a.publishedAt))
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-primary">{a.source}</span>
                {when ? <span>· {when}</span> : null}
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
    </FicheSection>
  );
}
