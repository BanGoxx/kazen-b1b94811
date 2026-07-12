import { useState } from "react";
import { CalendarDays, Play } from "lucide-react";
import type { MediaEpisode } from "@/lib/media-types";
import { SafeImage } from "@/components/media/SafeImage";

interface EpisodeListProps {
  episodes: MediaEpisode[];
}

const INITIAL_VISIBLE = 12;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Ordered episode list for anime/series fiches (Step D).
 * Aired episodes are highlighted; upcoming ones show a "À venir" badge.
 * Renders nothing when there is no episode data (graceful fallback).
 */
export function EpisodeList({ episodes }: EpisodeListProps) {
  const [expanded, setExpanded] = useState(false);
  if (!episodes.length) return null;

  const visible = expanded ? episodes : episodes.slice(0, INITIAL_VISIBLE);
  const airedCount = episodes.filter((e) => e.isAired).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {airedCount} épisode{airedCount > 1 ? "s" : ""} diffusé{airedCount > 1 ? "s" : ""}
        {episodes.length > airedCount ? ` · ${episodes.length - airedCount} à venir` : ""}
      </p>

      <ul className="grid gap-2 sm:grid-cols-2">
        {visible.map((ep) => {
          const date = formatDate(ep.airDate);
          return (
            <li
              key={`${ep.number}-${ep.title ?? ""}`}
              className={`flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-2 transition-colors ${
                ep.isAired ? "" : "opacity-70"
              }`}
            >
              <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg">
                <SafeImage
                  src={ep.thumbnailUrl ?? undefined}
                  alt={ep.title ?? `Épisode ${ep.number}`}
                  kind="backdrop"
                  className="h-full w-full object-cover"
                />
                {ep.isAired ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                    <Play className="h-5 w-5 text-white" />
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary">Ép. {ep.number}</span>
                  {!ep.isAired ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                      À venir
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-sm font-medium text-foreground">
                  {ep.title ?? `Épisode ${ep.number}`}
                </p>
                {date ? (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" /> {date}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {episodes.length > INITIAL_VISIBLE ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          {expanded ? "Réduire" : `Voir les ${episodes.length} épisodes`}
        </button>
      ) : null}
    </div>
  );
}
