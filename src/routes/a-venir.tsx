import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { MediaGrid, MediaGridSkeleton } from "@/components/media/MediaGrid";
import { EmptyState } from "@/components/media/EmptyState";
import type { MediaItem, MediaType } from "@/lib/media-types";
import { MEDIA_TYPE_LABELS } from "@/lib/media-types";
import { PLATFORMS } from "@/lib/platforms";
import { upcomingAllQO } from "@/lib/queries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/a-venir")({
  head: () => ({
    meta: [
      { title: "À venir — KAZEN" },
      { name: "description", content: "Toutes les prochaines sorties anime, séries et films, classées par date de sortie." },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(upcomingAllQO);
  },
  component: UpcomingPage,
  pendingComponent: () => (
    <AppShell>
      <PageHeader title="Sorties à venir" description="Anime, séries et films attendus, du plus proche au plus lointain." />
      <MediaGridSkeleton count={10} />
    </AppShell>
  ),
});

type Filter = MediaType | "all";
type SortOrder = "soon" | "later" | "popular";

const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

const SORT_LABELS: Record<SortOrder, string> = {
  soon: "Les plus proches",
  later: "Les plus lointaines",
  popular: "Les plus populaires",
};

function UpcomingPage() {
  const { data } = useSuspenseQuery(upcomingAllQO);
  const [filter, setFilter] = useState<Filter>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [sort, setSort] = useState<SortOrder>("soon");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: data.length, anime: 0, series: 0, movie: 0 };
    for (const it of data) c[it.mediaType]++;
    return c;
  }, [data]);

  const availablePlatforms = useMemo(() => {
    const ids = new Set<string>();
    for (const it of data) for (const p of it.platforms) ids.add(p.id);
    return PLATFORMS.filter((p) => ids.has(p.id));
  }, [data]);

  const visible = useMemo(
    () =>
      data
        .filter((it) => filter === "all" || it.mediaType === filter)
        .filter((it) => platform === "all" || it.platforms.some((p) => p.id === platform))
        .filter((it) => it.releaseDate),
    [data, filter, platform],
  );

  // For the popular sort we render a flat grid; for date sorts we group by month.
  const grouped = sort !== "popular";

  const flat = useMemo(
    () =>
      [...visible].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [visible],
  );

  const groups = useMemo(() => {
    const sorted = [...visible].sort((a, b) => {
      const cmp = a.releaseDate! < b.releaseDate! ? -1 : a.releaseDate! > b.releaseDate! ? 1 : 0;
      return sort === "later" ? -cmp : cmp;
    });
    const map = new Map<string, MediaItem[]>();
    for (const it of sorted) {
      const key = monthKey(it.releaseDate!);
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [visible, sort]);

  return (
    <AppShell>
      <PageHeader
        title="Sorties à venir"
        description="Anime, séries et films attendus, du plus proche au plus lointain."
      />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
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

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="h-9 w-40" aria-label="Filtrer par plateforme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes plateformes</SelectItem>
              {availablePlatforms.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortOrder)}>
            <SelectTrigger className="h-9 w-44" aria-label="Trier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortOrder[]).map((s) => (
                <SelectItem key={s} value={s}>{SORT_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length ? (
        grouped ? (
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
          <MediaGrid items={flat} />
        )
      ) : (
        <EmptyState message="Aucune sortie annoncée avec ces filtres." hint="Modifiez le type ou la plateforme, ou revenez bientôt." />
      )}
    </AppShell>
  );
}
