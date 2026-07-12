import { Award } from "lucide-react";
import type { PublicBadge } from "@/lib/founder";
import { cn } from "@/lib/utils";

const VARIANT_STYLES: Record<string, string> = {
  default: "border-border bg-muted text-muted-foreground",
  ember: "border-primary/40 bg-primary/10 text-primary",
  gold: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  cyan: "border-cyan-500/40 bg-cyan-500/10 text-cyan-500",
};

export function PublicBadgeChip({
  badge,
  className,
}: {
  badge: PublicBadge;
  className?: string;
}) {
  const style = VARIANT_STYLES[badge.visual_variant] ?? VARIANT_STYLES.default;
  return (
    <span
      title={badge.description || badge.label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold",
        style,
        className,
      )}
    >
      <Award className="h-3 w-3" aria-hidden />
      {badge.label}
    </span>
  );
}

/**
 * Renders a small, capped list of a user's public badges. Founder badge is
 * rendered separately (outranks these); keep the visible count subtle.
 */
export function PublicBadgeList({
  badges,
  max = 2,
  className,
}: {
  badges: PublicBadge[];
  max?: number;
  className?: string;
}) {
  if (!badges.length) return null;
  const shown = badges.slice(0, max);
  const extra = badges.length - shown.length;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {shown.map((b) => (
        <PublicBadgeChip key={b.id} badge={b} />
      ))}
      {extra > 0 && (
        <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[0.62rem] font-semibold text-muted-foreground">
          +{extra}
        </span>
      )}
    </span>
  );
}
