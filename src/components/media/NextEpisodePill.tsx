import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import type { MediaItem } from "@/lib/media-types";
import { getNextEpisodeSignal } from "@/lib/next-episode";
import { cn } from "@/lib/utils";

/**
 * Lightweight, glanceable next-episode chip for cards and compact contexts.
 * Reuses the shared `getNextEpisodeSignal` (single source of truth) and hides
 * itself when there is no valid upcoming episode. Refreshes on a slow tick so
 * a "dans X h" / "aujourd'hui" label never goes stale on a long-open page.
 */
export function NextEpisodePill({
  nextEpisode,
  className,
}: {
  nextEpisode: MediaItem["nextEpisode"];
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!nextEpisode?.airDate) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [nextEpisode?.airDate]);

  const signal = getNextEpisodeSignal(nextEpisode, now);
  if (!signal) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold ring-1 ring-inset backdrop-blur-md",
        signal.today
          ? "bg-primary/90 text-primary-foreground ring-primary/40"
          : signal.imminent
            ? "bg-primary/20 text-primary ring-primary/40"
            : "bg-background/70 text-foreground ring-white/10",
        className,
      )}
    >
      <CalendarClock className="h-3 w-3 shrink-0" />
      <span className="truncate">{signal.short}</span>
    </span>
  );
}
