import { BookmarkCheck, Heart, Star } from "lucide-react";
import { WATCH_STATUS_LABELS } from "@/lib/media-types";
import { useUserEntry } from "@/lib/use-list";
import { cn } from "@/lib/utils";

/**
 * At-a-glance tracking state, shown inline near the fiche title. Makes a fiche
 * useful on return visits: the user instantly sees their status, rating and
 * favorite without scrolling to the member panel. Renders nothing when the
 * title isn't tracked (or the user is signed out).
 */
export function FicheTrackingBadge({ mediaKey }: { mediaKey: string }) {
  const entry = useUserEntry(mediaKey);
  if (!entry) return null;

  const bits: React.ReactNode[] = [];

  if (entry.status) {
    bits.push(
      <span
        key="status"
        className="inline-flex items-center gap-1 rounded-full aurora-bg px-2.5 py-1 text-xs font-semibold text-white"
      >
        <BookmarkCheck className="h-3.5 w-3.5" />
        {WATCH_STATUS_LABELS[entry.status]}
      </span>,
    );
  } else {
    bits.push(
      <span
        key="inlist"
        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
      >
        <BookmarkCheck className="h-3.5 w-3.5" /> Dans ma liste
      </span>,
    );
  }

  if (entry.rating) {
    bits.push(
      <span
        key="rating"
        className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-400"
      >
        <Star className="h-3.5 w-3.5 fill-current" />
        {entry.rating}/10
      </span>,
    );
  }

  if (entry.favorite) {
    bits.push(
      <span
        key="fav"
        className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-400"
      >
        <Heart className="h-3.5 w-3.5 fill-current" /> Favori
      </span>,
    );
  }

  return <div className={cn("flex flex-wrap items-center gap-1.5")}>{bits}</div>;
}
