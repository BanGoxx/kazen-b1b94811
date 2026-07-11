import { Link } from "@tanstack/react-router";
import { Play, Info } from "lucide-react";
import type { MediaItem } from "@/lib/media-types";
import { MEDIA_TYPE_LABELS } from "@/lib/media-types";
import { RatingBadge } from "./RatingBadge";
import { SafeImage } from "./SafeImage";
import { PlatformRow } from "./PlatformBadge";
import { Button } from "@/components/ui/button";

export function DiscoverHero({ item }: { item: MediaItem }) {
  return (
    <section className="grain relative mb-12 overflow-hidden rounded-[1.75rem] border border-border shadow-[var(--shadow-float)]">
      <div className="absolute inset-0">
        {item.backdropUrl || item.posterUrl ? (
          <img
            src={item.backdropUrl || item.posterUrl || ""}
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="h-full w-full scale-105 object-cover"
          />
        ) : (
          <div className="h-full w-full aurora-bg opacity-40" />
        )}
        <div className="cinematic-scrim absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
      </div>

      <div className="relative flex min-h-[26rem] flex-col justify-end gap-5 p-6 sm:min-h-[30rem] sm:p-10 lg:max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full aurora-bg px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-[var(--shadow-glow)]">
            {MEDIA_TYPE_LABELS[item.mediaType]}
          </span>
          <RatingBadge score={item.score} />
          {item.genres.slice(0, 3).map((g) => (
            <span key={g} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-muted-foreground backdrop-blur">
              {g}
            </span>
          ))}
        </div>
        <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-6xl">
          {item.title}
        </h1>
        {item.synopsis ? (
          <p className="line-clamp-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {item.synopsis}
          </p>
        ) : null}
        <PlatformRow platforms={item.platforms} max={4} />
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild size="lg" className="aurora-bg text-white shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.03] hover:opacity-95">
            <Link to="/media/$source/$id" params={{ source: item.source, id: item.externalId }}>
              <Info className="mr-1 h-4 w-4" /> Voir la fiche
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="border border-white/10 backdrop-blur transition-transform hover:scale-[1.03]">
            <Link to="/a-venir">
              <Play className="mr-1 h-4 w-4" /> Sorties à venir
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
