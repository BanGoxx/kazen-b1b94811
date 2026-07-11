import { Link } from "@tanstack/react-router";
import { Play, Info } from "lucide-react";
import type { MediaItem } from "@/lib/media-types";
import { MEDIA_TYPE_LABELS } from "@/lib/media-types";
import { RatingBadge } from "./RatingBadge";
import { PlatformRow } from "./PlatformBadge";
import { Button } from "@/components/ui/button";

export function DiscoverHero({ item }: { item: MediaItem }) {
  return (
    <section className="relative mb-12 overflow-hidden rounded-3xl border border-border">
      <div className="absolute inset-0">
        {item.backdropUrl || item.posterUrl ? (
          <img
            src={item.backdropUrl || item.posterUrl || ""}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full aurora-bg opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="relative flex min-h-[24rem] flex-col justify-end gap-4 p-6 sm:min-h-[28rem] sm:p-10 lg:max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full aurora-bg px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            {MEDIA_TYPE_LABELS[item.mediaType]}
          </span>
          <RatingBadge score={item.score} />
          {item.genres.slice(0, 3).map((g) => (
            <span key={g} className="rounded-full bg-muted/80 px-2.5 py-0.5 text-xs text-muted-foreground backdrop-blur">
              {g}
            </span>
          ))}
        </div>
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          {item.title}
        </h1>
        {item.synopsis ? (
          <p className="line-clamp-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            {item.synopsis}
          </p>
        ) : null}
        <PlatformRow platforms={item.platforms} max={4} />
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild size="lg" className="aurora-bg text-white hover:opacity-90">
            <Link to="/media/$source/$id" params={{ source: item.source, id: item.externalId }}>
              <Info className="mr-1 h-4 w-4" /> Voir la fiche
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/a-venir">
              <Play className="mr-1 h-4 w-4" /> Sorties à venir
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
