import type { MediaItem } from "@/lib/media-types";
import { cn } from "@/lib/utils";

// Derives contextual browsing badges (VF/VOSTFR, Nouveau, À venir, En cours)
// from the normalized MediaItem. Purely presentational — no external calls.

type BadgeTone = "aurora" | "cyan" | "amber" | "emerald" | "slate";

interface DerivedBadge {
  label: string;
  tone: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  aurora: "aurora-bg text-white",
  cyan: "bg-accent text-accent-foreground",
  amber: "bg-chart-4 text-background",
  emerald: "bg-chart-2 text-background",
  slate: "bg-background/80 text-foreground backdrop-blur",
};

const NEW_WINDOW_DAYS = 30;

export function deriveBadges(item: MediaItem): DerivedBadge[] {
  const badges: DerivedBadge[] = [];

  if (item.status === "a_venir") {
    badges.push({ label: "À venir", tone: "amber" });
  } else if (item.status === "en_cours") {
    badges.push({ label: "En cours", tone: "emerald" });
    if (isRecent(item.releaseDate)) badges.push({ label: "Nouveau", tone: "aurora" });
  } else if (isRecent(item.releaseDate)) {
    badges.push({ label: "Nouveau", tone: "aurora" });
  }

  // Language availability heuristic: anime is subtitled by default on FR
  // platforms; a VF dub is flagged when Netflix/ADN carry it.
  if (item.mediaType === "anime") {
    const hasVf = item.platforms.some((p) => p.id === "netflix" || p.id === "adn");
    badges.push({ label: hasVf ? "VF · VOSTFR" : "VOSTFR", tone: "slate" });
  }

  return badges.slice(0, 3);
}

function isRecent(date: string | null): boolean {
  if (!date) return false;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  return t <= now && now - t <= NEW_WINDOW_DAYS * 864e5;
}

export function MediaBadges({
  item,
  className,
}: {
  item: MediaItem;
  className?: string;
}) {
  const badges = deriveBadges(item);
  if (!badges.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {badges.map((b) => (
        <span
          key={b.label}
          className={cn(
            "rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide shadow-sm",
            TONE_CLASSES[b.tone],
          )}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}
