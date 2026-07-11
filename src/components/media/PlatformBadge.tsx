import type { Platform } from "@/lib/media-types";
import { cn } from "@/lib/utils";

export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold text-white shadow-sm",
        className,
      )}
      style={{ backgroundColor: platform.color }}
      title={platform.name}
    >
      {platform.logoUrl ? (
        <img src={platform.logoUrl} alt="" className="h-3 w-3 rounded-sm" loading="lazy" />
      ) : null}
      {platform.name}
    </span>
  );
}

export function PlatformRow({ platforms, max = 3 }: { platforms: Platform[]; max?: number }) {
  if (!platforms.length) return null;
  const shown = platforms.slice(0, max);
  const rest = platforms.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((p) => (
        <PlatformBadge key={p.id} platform={p} />
      ))}
      {rest > 0 ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}
