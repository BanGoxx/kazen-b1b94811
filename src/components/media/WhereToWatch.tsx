import { Clapperboard } from "lucide-react";
import type { Platform } from "@/lib/media-types";
import { PlatformBadge } from "./PlatformBadge";
import { useI18n } from "@/lib/i18n";

/**
 * "Où regarder" — groups providers by offer type (streaming / location /
 * achat) so a user immediately sees how to watch, not just where. Falls back
 * to a single flat list when every provider shares the same offer type.
 */
export function WhereToWatch({ platforms }: { platforms: Platform[] }) {
  const { t } = useI18n();
  if (!platforms.length) return null;

  const OFFER_GROUPS: { type: Platform["type"]; label: string }[] = [
    { type: "stream", label: t.catalog.offerStream },
    { type: "rent", label: t.catalog.offerRent },
    { type: "buy", label: t.catalog.offerBuy },
  ];

  const distinctTypes = new Set(platforms.map((p) => p.type));
  const grouped = distinctTypes.size > 1;

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
      <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Clapperboard className="h-3.5 w-3.5 text-primary" /> {t.fiche.whereToWatch}
      </h2>
      {grouped ? (
        <div className="space-y-3">
          {OFFER_GROUPS.map(({ type, label }) => {
            const group = platforms.filter((p) => p.type === type);
            if (!group.length) return null;
            return (
              <div key={type}>
                <p className="mb-1.5 text-[0.7rem] font-medium text-muted-foreground/80">
                  {label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.map((p) => (
                    <PlatformBadge key={p.id} platform={p} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <PlatformBadge key={p.id} platform={p} />
          ))}
        </div>
      )}
    </div>
  );
}
