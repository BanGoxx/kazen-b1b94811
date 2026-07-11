import { ExternalLink } from "lucide-react";
import type { Platform } from "@/lib/media-types";
import { openExternal } from "@/lib/external-link";
import { cn } from "@/lib/utils";

export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  const inner = (
    <>
      {platform.logoUrl ? (
        <img src={platform.logoUrl} alt="" className="h-3 w-3 rounded-sm" loading="lazy" />
      ) : null}
      {platform.name}
    </>
  );
  const base = cn(
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold text-white shadow-sm",
    className,
  );

  if (platform.url) {
    // Rendered as a button (not <a>) so it stays valid when nested inside a
    // card link — avoids invalid <a> inside <a> and the hydration warning.
    // The click always leaves KAZEN as a real top-level external navigation
    // (see openExternal) so frame-blocking providers like Crunchyroll no
    // longer fail with ERR_BLOCKED_BY_RESPONSE inside the embedded app frame.
    const url = platform.url;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          openExternal(url);
        }}
        className={cn(base, "focus-ring transition-transform hover:scale-[1.04]")}
        style={{ backgroundColor: platform.color }}
        title={`Ouvrir sur ${platform.name} (nouvel onglet)`}
        aria-label={`Ouvrir ${platform.name} dans un nouvel onglet — vous quittez KAZEN`}
      >
        {inner}
        <ExternalLink className="h-2.5 w-2.5 opacity-80" aria-hidden="true" />
      </button>
    );
  }

  return (
    <span className={base} style={{ backgroundColor: platform.color }} title={platform.name}>
      {inner}
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
