import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MessagesSquare, Plus, Lock, Pin, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useCategoryTopics } from "@/lib/forum";
import { AuthorByline } from "@/components/community/forum-ui";
import { useCoverUrls } from "@/lib/forum-cover";
import { SafeImage } from "@/components/media/SafeImage";

interface CategorySearch {
  page: number;
}

export const Route = createFileRoute("/communaute/c/$slug")({
  validateSearch: (search: Record<string, unknown>): CategorySearch => ({
    page: Math.max(0, Number(search.page) || 0),
  }),
  head: () => ({
    meta: [
      { title: "Rubrique — Communauté KAZEN" },
      {
        name: "description",
        content: "Parcourez les sujets de discussion de cette rubrique de la communauté KAZEN.",
      },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { page } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useCategoryTopics(slug, page);

  const category = data?.category ?? null;
  const topics = data?.topics ?? [];
  const pageCount = data?.pageCount ?? 1;
  const { data: coverUrls } = useCoverUrls(topics.map((t) => t.coverPath));

  function goPage(p: number) {
    navigate({ to: "/communaute/c/$slug", params: { slug }, search: { page: p } });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8 pb-16">
        <nav className="text-xs text-muted-foreground">
          <Link to="/communaute" className="hover:text-foreground">
            Communauté
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{category?.name ?? "…"}</span>
        </nav>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : !category ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-20 text-center">
            <p className="text-base font-semibold text-foreground">Rubrique introuvable</p>
            <Button asChild variant="aurora" size="sm" className="mt-5">
              <Link to="/communaute">Retour à la communauté</Link>
            </Button>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1.5">
                <h1 className="flex items-center gap-2 text-2xl font-bold">
                  <MessagesSquare className="h-6 w-6 text-primary" />
                  <span className="aurora-text">{category.name}</span>
                  {category.isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">{category.description}</p>
              </div>
              {!category.isLocked &&
                (user ? (
                  <Button asChild variant="aurora" size="sm" className="gap-1">
                    <Link to="/communaute/nouveau" search={{ category: slug }}>
                      <Plus className="h-4 w-4" /> Nouveau sujet
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="aurora" size="sm" className="gap-1">
                    <Link to="/auth" search={{ redirect: "/communaute/nouveau" }}>
                      <Plus className="h-4 w-4" /> Nouveau sujet
                    </Link>
                  </Button>
                ))}
            </header>

            {topics.length === 0 ? (
              <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
                <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 to-transparent text-primary">
                  <MessageSquare className="h-6 w-6" />
                </span>
                <p className="text-base font-semibold text-foreground">
                  Aucun sujet dans cette rubrique
                </p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Soyez le premier à lancer une discussion ici.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {topics.map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/communaute/t/$id"
                      params={{ id: t.id }}
                      className="group hover-lift flex items-start justify-between gap-4 rounded-2xl border border-border bg-card/50 p-4 backdrop-blur transition-colors hover:border-primary/50 hover:bg-card/70"
                    >
                      {t.coverPath && coverUrls?.get(t.coverPath) && (
                        <div className="hidden h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-muted/40 sm:block">
                          <SafeImage
                            src={coverUrls.get(t.coverPath)!}
                            variant="backdrop"
                            alt={t.coverAlt || t.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {t.isPinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                          {t.isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                          <h3 className="truncate text-base font-semibold text-foreground transition-colors group-hover:text-primary">
                            {t.title}
                          </h3>
                        </div>
                        <AuthorByline author={t.author} when={t.createdAt} />
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-semibold text-foreground">{t.replyCount}</div>
                        <div className="text-[11px] text-muted-foreground">
                          réponse{t.replyCount > 1 ? "s" : ""}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {pageCount > 1 && (
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 0}
                  onClick={() => goPage(page - 1)}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> Précédent
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= pageCount}
                  onClick={() => goPage(page + 1)}
                  className="gap-1"
                >
                  Suivant <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
