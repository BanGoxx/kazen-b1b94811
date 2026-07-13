import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessagesSquare,
  MessageSquare,
  Sparkles,
  Clapperboard,
  Compass,
  Plus,
  Lock,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useForumOverview, useRecentTopics } from "@/lib/forum";
import { timeAgo } from "@/components/community/forum-ui";
import { useCoverUrls } from "@/lib/forum-cover";
import { SafeImage } from "@/components/media/SafeImage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/communaute/")({
  head: () => ({
    meta: [
      { title: "Communauté — KAZEN" },
      {
        name: "description",
        content:
          "La communauté KAZEN : discutez anime, séries et films, partagez vos avis et vos recommandations dans un forum premium et bienveillant.",
      },
      { property: "og:title", content: "Communauté — KAZEN" },
      {
        property: "og:description",
        content: "Échangez avec les membres KAZEN autour de l'anime, des séries et des films.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunautePage,
});

const ICONS: Record<string, LucideIcon> = {
  MessagesSquare,
  MessageSquare,
  Sparkles,
  Clapperboard,
  Compass,
};

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? MessageSquare;
  return <Icon className={className} />;
}

function CommunautePage() {
  const { user } = useAuth();
  const { data: categories, isLoading } = useForumOverview();
  const { data: recent } = useRecentTopics(6);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-10 pb-16">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <MessagesSquare className="h-7 w-7 text-primary" />
              <span className="aurora-text">Communauté</span>
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Un espace de discussion premium pour parler anime, séries et films avec les autres
              membres de KAZEN. Choisissez une rubrique pour lire les sujets ou lancez le vôtre.
            </p>
          </div>
          <Button asChild variant="aurora" size="sm" className="gap-1">
            <Link
              to={user ? "/communaute/nouveau" : "/auth"}
              search={user ? { category: undefined } : { redirect: "/communaute/nouveau" }}
            >
              <Plus className="h-4 w-4" /> Nouveau sujet
            </Link>
          </Button>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Rubriques</h2>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(categories ?? []).map((c) => (
                  <Link
                    key={c.id}
                    to="/communaute/c/$slug"
                    params={{ slug: c.slug }}
                    className="group hover-lift flex items-start gap-4 rounded-2xl border border-border bg-card/50 p-5 backdrop-blur transition-colors hover:border-primary/50 hover:bg-card/70"
                  >
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-gradient-to-br from-primary/15 to-transparent text-primary">
                      <CategoryIcon name={c.icon} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-foreground transition-colors group-hover:text-primary">
                          {c.name}
                        </h3>
                        {c.isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {c.description}
                      </p>
                      {c.latest && (
                        <p className="mt-2 truncate text-xs text-muted-foreground/80">
                          Dernier : <span className="text-foreground/80">{c.latest.title}</span> ·{" "}
                          {timeAgo(c.latest.lastActivityAt)}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold text-foreground">{c.topicCount}</div>
                      <div className="text-[11px] text-muted-foreground">
                        sujet{c.topicCount > 1 ? "s" : ""}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Clock className="h-5 w-5 text-primary" /> Discussions récentes
            </h2>
            {recent && recent.length > 0 ? (
              <ul className="space-y-2">
                {recent.map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/communaute/t/$id"
                      params={{ id: t.id }}
                      className={cn(
                        "block rounded-xl border border-border/60 bg-card/40 p-3 transition-colors hover:border-primary/40 hover:bg-card/60",
                      )}
                    >
                      <p className="line-clamp-2 text-sm font-medium text-foreground">{t.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.author.displayName} · {timeAgo(t.lastActivityAt)} · {t.replyCount}{" "}
                        réponse{t.replyCount > 1 ? "s" : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-card/30 p-4 text-xs text-muted-foreground">
                Aucune discussion pour l'instant. Lancez la première !
              </p>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
