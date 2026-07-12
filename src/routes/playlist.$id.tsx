import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ListMusic, Globe, Lock, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MediaCard } from "@/components/media/MediaCard";
import { usePlaylist } from "@/lib/playlists";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/playlist/$id")({
  head: () => ({
    meta: [
      { title: "Playlist — KAZEN" },
      {
        name: "description",
        content: "Découvrez une playlist d'anime, séries et films partagée sur KAZEN.",
      },
    ],
  }),
  component: PlaylistPage,
  errorComponent: ({ error }) => (
    <AppShell>
      <p role="alert" className="mx-auto max-w-3xl py-16 text-center text-muted-foreground">
        {error.message}
      </p>
    </AppShell>
  ),
});

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function PlaylistPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { data, isLoading, isError } = usePlaylist(id);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8 pb-16">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>

        {isLoading ? (
          <p className="py-16 text-center text-muted-foreground">Chargement de la playlist…</p>
        ) : isError || !data ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">
              Cette playlist est introuvable ou privée.
            </p>
            <Button asChild variant="aurora" size="sm" className="mt-4">
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </div>
        ) : (
          <>
            <header className="space-y-3 rounded-3xl border border-border bg-card/50 p-6 backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-medium text-primary">
                <ListMusic className="h-4 w-4" /> Playlist
                {data.meta.isPublic ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Globe className="h-3 w-3" /> Publique
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Lock className="h-3 w-3" /> Privée
                  </span>
                )}
              </div>
              <h1 className="aurora-text text-3xl font-bold">{data.meta.title}</h1>
              {data.meta.description && (
                <p className="max-w-2xl text-sm text-muted-foreground">
                  {data.meta.description}
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Avatar className="h-7 w-7">
                  {data.ownerAvatar && <AvatarImage src={data.ownerAvatar} alt="" />}
                  <AvatarFallback className="bg-muted text-[10px]">
                    {initials(data.ownerName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  par <span className="font-medium text-foreground">{data.ownerName}</span> ·{" "}
                  {data.items.length} titre{data.items.length > 1 ? "s" : ""}
                </span>
              </div>
            </header>

            {data.items.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">
                Cette playlist ne contient encore aucun titre.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {data.items.map((pi) =>
                  pi.item ? <MediaCard key={pi.id} item={pi.item} /> : null,
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
