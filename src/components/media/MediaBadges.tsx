import type { MediaItem } from "@/lib/media-types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

// Derives contextual browsing badges (VF/VOSTFR, Nouveau, À venir, En cours)
// from the normalized MediaItem. Purely presentational — no external calls.

type BadgeTone = "aurora" | "cyan" | "amber" | "emerald" | "slate";
type BadgeKey =
  | "upcoming"
  | "ongoing"
  | "new"
  | "vf_vostfr"
  | "vostfr";

interface DerivedBadge {
  key: BadgeKey;
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
    badges.push({ key: "upcoming", tone: "amber" });
  } else if (item.status === "en_cours") {
    badges.push({ key: "ongoing", tone: "emerald" });
    if (isRecent(item.releaseDate)) badges.push({ key: "new", tone: "aurora" });
  } else if (isRecent(item.releaseDate)) {
    badges.push({ key: "new", tone: "aurora" });
  }

  if (item.mediaType === "anime") {
    const hasVf = item.platforms.some((p) => p.id === "netflix" || p.id === "adn");
    badges.push({ key: hasVf ? "vf_vostfr" : "vostfr", tone: "slate" });
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
  const { t } = useI18n();
  const badges = deriveBadges(item);
  if (!badges.length) return null;
  const label = (key: BadgeKey): string => {
    switch (key) {
      case "upcoming":
        return t.catalog.badgeUpcoming;
      case "ongoing":
        return t.catalog.badgeOngoing;
      case "new":
        return t.catalog.badgeNew;
      case "vf_vostfr":
        return t.catalog.badgeVfVostfr;
      case "vostfr":
        return t.catalog.badgeVostfr;
    }
  };
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {badges.map((b) => (
        <span
          key={b.key}
          className={cn(
            "rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide shadow-sm",
            TONE_CLASSES[b.tone],
          )}
        >
          {label(b.key)}
        </span>
      ))}
    </div>
  );
}
