import { Link } from "@tanstack/react-router";
import { Star, Calendar, Clapperboard, Layers } from "lucide-react";
import type { MediaItem } from "@/lib/media-types";
import { MEDIA_TYPE_LABELS } from "@/lib/media-types";
import { SafeImage } from "./SafeImage";
import { PlatformRow } from "./PlatformBadge";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<MediaItem["mediaType"], string> = {
  anime: "bg-primary/90 text-primary-foreground",
  series: "bg-accent/90 text-accent-foreground",
  movie: "bg-chart-3/90 text-white",
};

function year(item: MediaItem): string | null {
  if (!item.releaseDate) return null;
  const y = item.releaseDate.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : null;
}

function metaLine(item: MediaItem): string {
  const parts: string[] = [];
  const y = year(item);
  if (y) parts.push(y);
  if (item.mediaType === "movie" && item.runtime) parts.push(`${item.runtime} min`);
  if (item.mediaType !== "movie" && item.episodesCount) parts.push(`${item.episodesCount} ép.`);
  if (item.mediaType === "series" && item.seasonsCount) parts.push(`${item.seasonsCount} sais.`);
  return parts.join(" · ");
}

/**
 * Search-scoped result card. Richer than the generic MediaCard: on hover it
 * reveals a synopsis + metadata preview panel so users can judge a result
 * without opening the fiche. Intentionally NOT shared with the catalog.
 */
export function SearchResultCard({
  item,
  className,
  style,
}: {
  item: MediaItem;
  className?: string;
  style?: React.CSSProperties;
}) {
  const meta = metaLine(item);
  const scoreOutOf10 = item.score != null ? (item.score / 10).toFixed(1) : null;

  return (
    <Link
      to="/media/$source/$id"
      params={{ source: item.source, id: item.externalId }}
      style={style}
      className={cn(
        "group card-elevated relative block overflow-hidden rounded-2xl border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        <SafeImage
          src={item.posterUrl}
          alt={item.title}
          variant="poster"
          fallbackLabel={item.title}
          loading="lazy"
          decoding="async"
          width={300}
          height={450}
          className="h-full w-full object-cover transition-[transform,filter] duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07] group-hover:brightness-[0.55]"
        />

        {/* Top badges */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide shadow-sm backdrop-blur-sm",
              TYPE_COLORS[item.mediaType],
            )}
          >
            {MEDIA_TYPE_LABELS[item.mediaType]}
          </span>
          {scoreOutOf10 ? (
            <span className="flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[0.7rem] font-bold text-foreground shadow-sm backdrop-blur-sm">
              <Star className="h-3 w-3 fill-primary text-primary" />
              {scoreOutOf10}
            </span>
          ) : null}
        </div>

        {/* Hover preview panel */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[0.7rem] font-medium text-white/80">
            {year(item) ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {year(item)}
              </span>
            ) : null}
            {item.mediaType === "movie" && item.runtime ? (
              <span className="inline-flex items-center gap-1">
                <Clapperboard className="h-3 w-3" /> {item.runtime} min
              </span>
            ) : null}
            {item.mediaType !== "movie" && item.episodesCount ? (
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3 w-3" /> {item.episodesCount} ép.
              </span>
            ) : null}
          </div>
          {item.synopsis ? (
            <p className="line-clamp-4 text-xs leading-relaxed text-white/90">{item.synopsis}</p>
          ) : (
            <p className="text-xs italic text-white/60">Aucun synopsis disponible.</p>
          )}
        </div>
      </div>

      {/* Static footer */}
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-card-foreground transition-colors group-hover:text-primary">
          {item.title}
        </h3>
        {meta ? <p className="line-clamp-1 text-xs text-muted-foreground">{meta}</p> : null}
        {item.genres.length ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">{item.genres.slice(0, 3).join(" · ")}</p>
        ) : null}
        <PlatformRow platforms={item.platforms} max={2} />
      </div>
    </Link>
  );
}

const GRID = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

export function SearchResultGrid({ items, className }: { items: MediaItem[]; className?: string }) {
  const seen = new Set<string>();
  const unique = items.filter((item) => (seen.has(item.key) ? false : seen.add(item.key)));
  return (
    <div className={cn(GRID, className)}>
      {unique.map((item, i) => (
        <SearchResultCard
          key={item.key}
          item={item}
          className="animate-rise"
          style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
        />
      ))}
    </div>
  );
}
