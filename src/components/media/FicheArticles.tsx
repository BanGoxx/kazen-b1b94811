import { Newspaper, ArrowUpRight } from "lucide-react";
import { FicheSection } from "./FicheSection";

export interface FicheArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt?: string | null;
  excerpt?: string | null;
}

/**
 * Editorial "autour de ce titre" block. Purely presentational and
 * extension-ready: it renders nothing when there is no article to show, so the
 * fiche never displays an empty or broken-looking section. When a safe article
 * source is wired later, pass the normalized list here without redesigning the
 * page. All links open as clean external redirects.
 */
export function FicheArticles({ articles }: { articles: FicheArticle[] }) {
  if (!articles.length) return null;

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <FicheSection title="Autour de ce titre" icon={<Newspaper className="h-5 w-5" />}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {articles.map((a) => {
          const when =
            a.publishedAt && !Number.isNaN(new Date(a.publishedAt).getTime())
              ? dateFmt.format(new Date(a.publishedAt))
              : null;
          return (
            <li key={a.id}>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring group flex h-full flex-col gap-1 rounded-2xl border border-border bg-card/60 p-4 backdrop-blur transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-primary">{a.source}</span>
                  {when ? <span>· {when}</span> : null}
                  <ArrowUpRight className="ml-auto h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{a.title}</p>
                {a.excerpt ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{a.excerpt}</p>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </FicheSection>
  );
}
