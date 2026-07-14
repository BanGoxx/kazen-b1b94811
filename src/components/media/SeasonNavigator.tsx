import { Link } from "@tanstack/react-router";
import { CalendarDays, Layers, Tv } from "lucide-react";
import type { MediaDetail } from "@/lib/media-types";
import { buildSeasonChain } from "@/lib/seasons";
import { SafeImage } from "./SafeImage";
import { FicheSection } from "./FicheSection";
import { cn } from "@/lib/utils";

/**
 * Confident season navigation for a fiche. Renders only when reliable
 * sequel/prequel provider signals exist — otherwise nothing (no invented
 * seasons). Each season links to its own fiche; the current one is marked.
 */
export function SeasonNavigator({ detail }: { detail: MediaDetail }) {
  const chain = buildSeasonChain(detail);
  if (!chain || chain.entries.length < 2) return null;

  const { entries, currentIndex, total } = chain;
  const prev = currentIndex > 0 ? entries[currentIndex - 1] : null;
  const next = currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null;

  return (
    <FicheSection
      title="Saisons"
      icon={<Layers className="h-5 w-5" />}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {total ? (
          <span className="rounded-full border border-border bg-card/60 px-3 py-1 font-medium">
            {total} saison{total > 1 ? "s" : ""}
          </span>
        ) : (
          <span className="rounded-full border border-border bg-card/60 px-3 py-1 font-medium">
            Chaîne de saisons
          </span>
        )}
        {prev ? (
          <Link
            to="/media/$source/$id"
            params={{ source: prev.source, id: prev.externalId }}
            className="focus-ring rounded-full px-3 py-1 font-medium text-foreground transition-colors hover:text-primary"
          >
            ← Saison précédente
          </Link>
        ) : null}
        {next ? (
          <Link
            to="/media/$source/$id"
            params={{ source: next.source, id: next.externalId }}
            className="focus-ring rounded-full px-3 py-1 font-medium text-foreground transition-colors hover:text-primary"
          >
            Saison suivante →
          </Link>
        ) : null}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {entries.map((e) => {
          const inner = (
            <>
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted">
                <SafeImage
                  src={e.posterUrl ?? undefined}
                  alt={e.title}
                  className="h-full w-full object-cover"
                />
                {e.seasonNumber ? (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-white">
                    S{e.seasonNumber}
                  </span>
                ) : null}
                {e.isCurrent ? (
                  <span className="absolute right-1.5 top-1.5 rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                    Actuelle
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-tight">{e.title}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                {e.year ? (
                  <span className="inline-flex items-center gap-0.5">
                    <CalendarDays className="h-3 w-3" />
                    {e.year}
                  </span>
                ) : null}
                {e.episodesCount ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Tv className="h-3 w-3" />
                    {e.episodesCount} ép.
                  </span>
                ) : null}
              </div>
            </>
          );

          const base = "w-28 shrink-0";
          if (e.isCurrent) {
            return (
              <div
                key={e.key}
                className={cn(base, "rounded-lg ring-2 ring-primary/60")}
                aria-current="true"
              >
                {inner}
              </div>
            );
          }
          return (
            <Link
              key={e.key}
              to="/media/$source/$id"
              params={{ source: e.source, id: e.externalId }}
              className={cn(base, "focus-ring rounded-lg transition-transform hover:scale-[1.03]")}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </FicheSection>
  );
}
