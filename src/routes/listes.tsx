import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ListMusic, Plus, Sparkles, Clock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SafeImage } from "@/components/media/SafeImage";
import { usePublicPlaylists, type PublicPlaylistCard } from "@/lib/playlists";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/listes")({
  head: () => ({
    meta: [
      { title: "Listes partagées — KAZEN" },
      {
        name: "description",
        content:
          "Explorez les listes partagées par la communauté KAZEN : sélections d'anime, séries et films à découvrir.",
      },
      { property: "og:title", content: "Listes partagées — KAZEN" },
      {
        property: "og:description",
        content: "Des collections d'anime, séries et films curées par les membres de KAZEN.",
      },
    ],
  }),
  component: ListesPage,
});

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function PosterStack({ posters }: { posters: string[] }) {
  if (posters.length === 0) {
    return (
      <div className="flex h-24 w-full items-center justify-center rounded-xl bg-muted/40">
        <ListMusic className="h-6 w-6 text-muted-foreground/60" />
      </div>
    );
  }
  return (
    <div className="flex gap-1.5">
      {posters.slice(0, 4).map((p, i) => (
        <SafeImage
          key={i}
          src={p}
          alt=""
          className="h-24 w-16 flex-1 rounded-lg object-cover ring-1 ring-border"
        />
      ))}
    </div>
  );
}

function ListCard({ list, featured = false }: { list: PublicPlaylistCard; featured?: boolean }) {
  return (
    <Link
      to="/playlist/$id"
      params={{ id: list.id }}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border border-border bg-card/50 p-4 backdrop-blur transition-colors hover:border-primary/50 hover:bg-card/70",
        featured && "ring-1 ring-primary/20",
      )}
    >
      <PosterStack posters={list.posters} />
      <div className="min-w-0 space-y-1">
        <h3 className="line-clamp-1 text-base font-semibold text-foreground group-hover:text-primary">
          {list.title}
        </h3>
        {list.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {list.description}
          </p>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar className="h-5 w-5">
            {list.ownerAvatar && <AvatarImage src={list.ownerAvatar} alt="" />}
            <AvatarFallback className="bg-muted text-[9px]">
              {initials(list.ownerName)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{list.ownerName}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{list.count} titre{list.count > 1 ? "s" : ""}</span>
          {list.likeCount > 0 && (
            <span className="inline-flex items-center gap-1 text-primary">
              <Heart className="h-3 w-3 fill-current" /> {list.likeCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ListesPage() {
  const { data, isLoading } = usePublicPlaylists();
  const { user } = useAuth();

  const popular = data?.popular ?? [];
  const recent = data?.recent ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-10 pb-16">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <ListMusic className="h-7 w-7 text-primary" />
              <span className="aurora-text">Listes partagées</span>
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Des collections d'anime, séries et films curées par la communauté KAZEN. Parcourez,
              découvrez, et créez la vôtre.
            </p>
          </div>
          <Button asChild variant="aurora" size="sm" className="gap-1">
            <Link to={user ? "/mes-playlists" : "/auth"} search={user ? undefined : { redirect: "/mes-playlists" }}>
              <Plus className="h-4 w-4" /> Créer une liste
            </Link>
          </Button>
        </header>

        {isLoading ? (
          <p className="py-16 text-center text-muted-foreground">Chargement des listes…</p>
        ) : recent.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card/40 py-16 text-center">
            <p className="text-muted-foreground">
              Aucune liste partagée pour l'instant. Soyez le premier à en créer une !
            </p>
            <Button asChild variant="aurora" size="sm" className="mt-4 gap-1">
              <Link to={user ? "/mes-playlists" : "/auth"} search={user ? undefined : { redirect: "/mes-playlists" }}>
                <Plus className="h-4 w-4" /> Créer une liste
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {popular.length > 0 && (
              <section className="space-y-4 animate-fade-in">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Sparkles className="h-5 w-5 text-primary" /> Listes mises en avant
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {popular.map((l) => (
                    <ListCard key={l.id} list={l} featured />
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-4 animate-fade-in">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Clock className="h-5 w-5 text-primary" /> Les derniers partages
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recent.map((l) => (
                  <ListCard key={l.id} list={l} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
