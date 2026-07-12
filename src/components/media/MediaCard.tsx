import { Link } from "@tanstack/react-router";
import type { MediaItem } from "@/lib/media-types";
import { MEDIA_TYPE_LABELS } from "@/lib/media-types";
import { SafeImage } from "./SafeImage";
import { RatingBadge } from "./RatingBadge";
import { PlatformRow } from "./PlatformBadge";
import { MediaBadges } from "./MediaBadges";
import { NextEpisodePill } from "./NextEpisodePill";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<MediaItem["mediaType"], string> = {
  anime: "bg-primary/85 text-primary-foreground ring-primary/30",
  series: "bg-accent/85 text-accent-foreground ring-accent/30",
  movie: "bg-chart-3/85 text-white ring-chart-3/30",
};

export function MediaCard({
  item,
  className,
  style,
}: {
  item: MediaItem;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Link
      to="/media/$source/$id"
      params={{ source: item.source, id: item.externalId }}
      style={style}
      className={cn(
        "group card-elevated gradient-frame relative block overflow-hidden rounded-2xl border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
          className="h-full w-full object-cover transition-[transform,filter] duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07] group-hover:brightness-[1.05]"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <span className={cn("rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] shadow-sm ring-1 ring-inset backdrop-blur-md", TYPE_COLORS[item.mediaType])}>
            {MEDIA_TYPE_LABELS[item.mediaType]}
          </span>
          <RatingBadge score={item.score} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-11 flex justify-start p-2.5">
          <NextEpisodePill nextEpisode={item.nextEpisode} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-card via-card/60 to-transparent opacity-95 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end p-2.5">
          <MediaBadges item={item} />
        </div>
      </div>
      <div className="space-y-1.5 p-3.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug tracking-[-0.01em] text-card-foreground transition-colors duration-300 group-hover:text-primary">
          {item.title}
        </h3>
        {item.genres.length ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">{item.genres.slice(0, 3).join(" · ")}</p>
        ) : null}
        <PlatformRow platforms={item.platforms} max={2} />
      </div>
    </Link>
  );
}
