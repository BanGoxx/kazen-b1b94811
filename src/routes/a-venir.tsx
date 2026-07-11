import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { MediaGrid } from "@/components/media/MediaGrid";
import { EmptyState } from "@/components/media/EmptyState";
import type { MediaItem, MediaType } from "@/lib/media-types";
import { MEDIA_TYPE_LABELS } from "@/lib/media-types";
import { upcomingAllQO } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/a-venir")({
  head: () => ({
    meta: [
      { title: "À venir — NEXUS MEDIA" },
      { name: "description", content: "Toutes les prochaines sorties anime, séries et films, classées par date de sortie." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(upcomingAllQO);
  },
  component: UpcomingPage,
});

type Filter = MediaType | "all";

const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function UpcomingPage() {
  const { data } = useSuspenseQuery(upcomingAllQO);
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: data.length, anime: 0, series: 0, movie: 0 };
    for (const it of data) c[it.mediaType]++;
    return c;
  }, [data]);

  const groups = useMemo(() => {
    const filtered = data
      .filter((it) => filter === "all" || it.mediaType === filter)
      .filter((it) => it.releaseDate)
      .sort((a, b) => (a.releaseDate! < b.releaseDate! ? -1 : 1));
    const map = new Map<string, MediaItem[]>();
    for (const it of filtered) {
      const key = monthKey(it.releaseDate!);
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [data, filter]);

  return (
    <AppShell>
      <PageHeader
        title="Sorties à venir"
        description="Anime, séries et films attendus, du plus proche au plus lointain."
      />

      <div className="mb-8 flex flex-wrap gap-2">
        {(["all", "anime", "series", "movie"] as Filter[]).map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f)}
              className={cn(
                "focus-ring rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                active
                  ? "border-transparent aurora-bg text-white"
                  : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "all" ? "Tout" : MEDIA_TYPE_LABELS[f]}
              <span className="ml-1.5 text-xs opacity-70">{counts[f]}</span>
            </button>
          );
        })}
      </div>

      {groups.length ? (
        <div className="space-y-12">
          {groups.map(([key, items]) => (
            <section key={key}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="font-display text-xl font-bold capitalize">
                  {monthFmt.format(new Date(`${key}-01T00:00:00`))}
                </h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {items.length}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <MediaGrid items={items} />
            </section>
          ))}
        </div>
      ) : (
        <EmptyState message="Aucune sortie annoncée pour le moment." hint="Revenez bientôt pour découvrir les prochaines nouveautés." />
      )}
    </AppShell>
  );
}
