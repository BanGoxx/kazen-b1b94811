import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { MediaCard } from "@/components/media/MediaCard";
import { EmptyState } from "@/components/media/EmptyState";
import type { MediaItem } from "@/lib/media-types";
import { upcomingAllQO } from "@/lib/queries";

export const Route = createFileRoute("/calendrier")({
  head: () => ({
    meta: [
      { title: "Calendrier des sorties — NEXUS MEDIA" },
      { name: "description", content: "Le calendrier des sorties anime et films regroupées par date." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(upcomingAllQO);
  },
  component: CalendarPage,
});

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function groupByDate(items: MediaItem[]): [string, MediaItem[]][] {
  const map = new Map<string, MediaItem[]>();
  for (const item of items) {
    if (!item.releaseDate) continue;
    const arr = map.get(item.releaseDate) ?? [];
    arr.push(item);
    map.set(item.releaseDate, arr);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const s = dateFmt.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function CalendarPage() {
  const { data } = useSuspenseQuery(upcomingAllQO);
  const groups = groupByDate(data);

  return (
    <AppShell>
      <PageHeader
        title="Calendrier"
        description="Les prochaines sorties, jour par jour."
      />
      {groups.length ? (
        <div className="space-y-10">
          {groups.map(([date, items]) => (
            <section key={date}>
              <div className="mb-4 flex items-center gap-3">
                <span className="h-6 w-1 rounded-full aurora-bg" />
                <h2 className="font-display text-lg font-bold sm:text-xl">{formatDay(date)}</h2>
                <span className="text-sm text-muted-foreground">{items.length} sortie{items.length > 1 ? "s" : ""}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {items.map((item) => (
                  <MediaCard key={item.key} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState message="Aucune date de sortie disponible pour le moment." />
      )}
    </AppShell>
  );
}
