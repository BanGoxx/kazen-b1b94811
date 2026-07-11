import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { EmptyState } from "@/components/media/EmptyState";
import type { MediaItem, MediaType, WatchStatus } from "@/lib/media-types";
import { MEDIA_TYPE_LABELS, WATCH_STATUS_LABELS } from "@/lib/media-types";
import { PLATFORMS } from "@/lib/platforms";
import { upcomingAllQO, onAirSeriesQO } from "@/lib/queries";
import { useUserList } from "@/lib/user-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendrier")({
  head: () => ({
    meta: [
      { title: "Calendrier des sorties — NEXUS MEDIA" },
      { name: "description", content: "Le calendrier hebdomadaire des sorties anime, séries et films." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(upcomingAllQO);
    context.queryClient.ensureQueryData(onAirSeriesQO);
  },
  component: CalendarPage,
});

const TYPE_DOT: Record<MediaType, string> = {
  anime: "bg-primary",
  series: "bg-accent",
  movie: "bg-chart-3",
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const rangeFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  return date;
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type StatusFilter = MediaType | "all";
type WatchFilter = WatchStatus | "all" | "tracked" | "untracked";

function CalendarPage() {
  const { data: upcoming } = useSuspenseQuery(upcomingAllQO);
  const { data: series } = useSuspenseQuery(onAirSeriesQO);
  const userList = useUserList();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [type, setType] = useState<StatusFilter>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [watch, setWatch] = useState<WatchFilter>("all");

  const all = useMemo<MediaItem[]>(() => [...upcoming, ...series], [upcoming, series]);

  const availablePlatforms = useMemo(() => {
    const ids = new Set<string>();
    for (const it of all) for (const p of it.platforms) ids.add(p.id);
    return PLATFORMS.filter((p) => ids.has(p.id));
  }, [all]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  const filtered = useMemo(() => {
    const weekKeys = new Set(days.map(isoDay));
    return all.filter((it) => {
      if (!it.releaseDate || !weekKeys.has(it.releaseDate.slice(0, 10))) return false;
      if (type !== "all" && it.mediaType !== type) return false;
      if (platform !== "all" && !it.platforms.some((p) => p.id === platform)) return false;
      if (watch !== "all") {
        const entry = userList[it.key];
        if (watch === "tracked" && !entry) return false;
        if (watch === "untracked" && entry) return false;
        if (watch !== "tracked" && watch !== "untracked" && entry?.status !== watch) return false;
      }
      return true;
    });
  }, [all, days, type, platform, watch, userList]);

  const byDay = useMemo(() => {
    const map = new Map<string, MediaItem[]>();
    for (const it of filtered) {
      const key = it.releaseDate!.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return map;
  }, [filtered]);

  const todayIso = isoDay(new Date());
  const weekEnd = days[6];
  const rangeLabel = `${rangeFmt.format(weekStart)} – ${rangeFmt.format(weekEnd)} ${weekEnd.getFullYear()}`;

  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + delta * 7);
    setWeekStart(d);
  };

  return (
    <AppShell>
      <PageHeader
        title="Calendrier"
        description="Les sorties de la semaine, jour par jour."
      />

      {/* Week navigation */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" aria-label="Semaine précédente" onClick={() => shiftWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-52 text-center font-display text-lg font-bold capitalize">{rangeLabel}</span>
          <Button variant="secondary" size="icon" aria-label="Semaine suivante" onClick={() => shiftWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="premium" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
          <CalendarDays className="mr-1 h-4 w-4" /> Cette semaine
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/50 p-4 backdrop-blur">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "anime", "series", "movie"] as StatusFilter[]).map((t) => {
            const active = type === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => setType(t)}
                className={cn(
                  "focus-ring rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  active
                    ? "border-transparent aurora-bg text-white"
                    : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "all" ? "Tout" : MEDIA_TYPE_LABELS[t]}
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
          <Select value={watch} onValueChange={(v) => setWatch(v as WatchFilter)}>
            <SelectTrigger className="h-9 w-40" aria-label="Filtrer par statut">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="tracked">Dans ma liste</SelectItem>
              <SelectItem value="untracked">Hors liste</SelectItem>
              {(Object.keys(WATCH_STATUS_LABELS) as WatchStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{WATCH_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Weekly grid */}
      {filtered.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((d, i) => {
            const key = isoDay(d);
            const items = byDay.get(key) ?? [];
            const isToday = key === todayIso;
            return (
              <div
                key={key}
                className={cn(
                  "flex min-h-40 flex-col rounded-2xl border p-2",
                  isToday ? "border-primary/50 bg-primary/5" : "border-border bg-card/40",
                )}
              >
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <span className={cn("text-xs font-bold uppercase", isToday ? "text-primary" : "text-muted-foreground")}>
                    {DAY_LABELS[i]}
                  </span>
                  <span className={cn("text-lg font-extrabold", isToday && "text-primary")}>{d.getDate()}</span>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  {items.length ? (
                    items.map((it) => <CalendarEntry key={it.key} item={it} />)
                  ) : (
                    <span className="px-1 text-[0.7rem] text-muted-foreground/60">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState message="Aucune sortie cette semaine avec ces filtres." hint="Changez de semaine ou réinitialisez les filtres." />
      )}
    </AppShell>
  );
}

function CalendarEntry({ item }: { item: MediaItem }) {
  return (
    <Link
      to="/media/$source/$id"
      params={{ source: item.source, id: item.externalId }}
      className="group flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 p-1.5 transition-colors hover:border-primary/40"
    >
      <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
        {item.posterUrl ? (
          <img src={item.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-3 w-3" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TYPE_DOT[item.mediaType])} />
          <span className="truncate text-[0.7rem] font-semibold group-hover:text-primary">{item.title}</span>
        </div>
        {item.platforms[0] ? (
          <span className="truncate text-[0.65rem] text-muted-foreground">{item.platforms[0].name}</span>
        ) : (
          <span className="text-[0.65rem] text-muted-foreground">{MEDIA_TYPE_LABELS[item.mediaType]}</span>
        )}
      </div>
    </Link>
  );
}
