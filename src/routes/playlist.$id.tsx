import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ListMusic, Globe, Lock, ArrowLeft, Heart, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SafeImage } from "@/components/media/SafeImage";
import { usePlaylist, usePlaylistLike } from "@/lib/playlists";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MEDIA_TYPE_LABELS } from "@/lib/media-types";
import type { PlaylistItem } from "@/lib/playlists";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/playlist/$id")({
  head: () => ({
    meta: [
      { title: "Liste partagée — KAZEN" },
      {
        name: "description",
        content: "Découvrez une liste d'anime, séries et films partagée sur KAZEN.",
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

function year(date: string | null): string | null {
  if (!date) return null;
  const m = /^(\d{4})/.exec(date);
  return m ? m[1] : null;
}

function LikeButton({ id, likeCount }: { id: string; likeCount: number }) {
  const { liked, toggle, canLike } = usePlaylistLike(id);
  // likeCount already includes the current user's like (from the detail query),
  // so we display it directly and let query invalidation refresh after toggle.
  const total = likeCount;


  if (!canLike) {
    return (
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <Link to="/auth" search={{ redirect: `/playlist/${id}` }}>
          <Heart className="h-4 w-4" /> {likeCount > 0 ? likeCount : "J'aime"}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant={liked ? "aurora" : "outline"}
      size="sm"
      className="gap-1.5"
      disabled={toggle.isPending}
      onClick={() => toggle.mutate(liked)}
    >
      <Heart className={cn("h-4 w-4", liked && "fill-current")} />
      {total > 0 ? total : "J'aime"}
    </Button>
  );
}

function ListItemRow({ pi, index }: { pi: PlaylistItem; index: number }) {
  const item = pi.item;
  if (!item) return null;
  const y = year(item.releaseDate);
  const excerpt = pi.note?.trim();

  return (
    <Link
      to="/media/$source/$id"
      params={{ source: item.source, id: item.externalId }}
      className="group flex items-start gap-4 rounded-2xl border border-border bg-card/40 p-3 transition-colors hover:border-primary/50 hover:bg-card/70 sm:p-4"
    >
      <span className="mt-1 hidden w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground/60 sm:block">
        {index + 1}
      </span>
      <SafeImage
        src={item.posterUrl}
        alt={item.title}
        fallbackLabel={item.title}
        className="h-24 w-16 shrink-0 rounded-lg object-cover ring-1 ring-border sm:h-28 sm:w-20"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-primary">
            {MEDIA_TYPE_LABELS[item.mediaType]}
          </span>
          {y && <span className="text-xs text-muted-foreground">{y}</span>}
          {typeof item.score === "number" && (
            <span className="text-xs text-muted-foreground">★ {item.score.toFixed(1)}</span>
          )}
        </div>
        <h3 className="line-clamp-1 text-base font-semibold text-foreground group-hover:text-primary">
          {item.title}
        </h3>
        {excerpt ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{excerpt}</p>
        ) : (
          item.genres.length > 0 && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {item.genres.slice(0, 3).join(" · ")}
            </p>
          )
        )}
      </div>
      <ChevronRight className="mt-6 hidden h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary sm:block" />
    </Link>
  );
}

function PlaylistPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { data, isLoading, isError } = usePlaylist(id);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8 pb-16">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <Link to="/listes">
              <ListMusic className="h-4 w-4" /> Toutes les listes
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <p className="py-16 text-center text-muted-foreground">Chargement de la liste…</p>
        ) : isError || !data ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">Cette liste est introuvable ou privée.</p>
            <Button asChild variant="aurora" size="sm" className="mt-4">
              <Link to="/listes">Explorer les listes partagées</Link>
            </Button>
          </div>
        ) : (
          <>
            <header className="space-y-3 rounded-3xl border border-border bg-card/50 p-6 backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-medium text-primary">
                <ListMusic className="h-4 w-4" /> Liste partagée
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
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {data.meta.description}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
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
                <LikeButton id={id} likeCount={data.likeCount} />
              </div>
            </header>

            {data.items.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">
                Cette liste ne contient encore aucun titre.
              </p>
            ) : (
              <div className="space-y-3">
                {data.items.map((pi, i) => (
                  <ListItemRow key={pi.id} pi={pi} index={i} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
