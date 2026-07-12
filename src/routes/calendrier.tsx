import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { EmptyState } from "@/components/media/EmptyState";
import { SafeImage } from "@/components/media/SafeImage";
import type { MediaItem, MediaType, WatchStatus } from "@/lib/media-types";
import { MEDIA_TYPE_LABELS, WATCH_STATUS_LABELS } from "@/lib/media-types";
import { PLATFORMS } from "@/lib/platforms";
import { upcomingAllQO, onAirSeriesQO, trendingAnimeQO, popularAnimeQO } from "@/lib/queries";
import { useUserList } from "@/lib/user-list";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendrier")({
  head: () => ({
    meta: [
      { title: "Calendrier des sorties — KAZEN" },
      { name: "description", content: "Le calendrier hebdomadaire des sorties anime, séries et films." },
      { property: "og:title", content: "Calendrier des sorties — KAZEN" },
      { property: "og:description", content: "Le calendrier hebdomadaire des sorties anime, séries et films." },
      { property: "og:url", content: "https://kazen.lovable.app/calendrier" },
    ],
    links: [{ rel: "canonical", href: "https://kazen.lovable.app/calendrier" }],
  }),
  loader: async ({ context }) => {
    void context.queryClient.ensureQueryData(upcomingAllQO);
    void context.queryClient.prefetchQuery(onAirSeriesQO);
    // Currently-airing anime carry `nextEpisode`; prefetch so weekly episodes
    // (not just premieres) can populate the grid.
    void context.queryClient.prefetchQuery(trendingAnimeQO);
    void context.queryClient.prefetchQuery(popularAnimeQO);
  },
  component: CalendarPage,
  pendingComponent: () => (
    <AppShell>
      <PageHeader title="Calendrier" description="Les sorties de la semaine, jour par jour." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="min-h-40 rounded-2xl border border-border bg-card/40 p-2">
            <Skeleton className="mb-3 h-4 w-10" />
            <Skeleton className="mb-1.5 h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </AppShell>
  ),
});

const TYPE_DOT: Record<MediaType, string> = {
  anime: "bg-primary",
  series: "bg-accent",
  movie: "bg-chart-3",
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const rangeFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const weekLabelFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

// Anime-first ordering keeps scheduling coherent with the rest of KAZEN, then
// séries, then films; ties broken alphabetically for a stable, readable list.
const TYPE_ORDER: Record<MediaType, number> = { anime: 0, series: 1, movie: 2 };
const TYPE_LEGEND: MediaType[] = ["anime", "series", "movie"];

function sortEntries(items: MediaItem[]): MediaItem[] {
  return [...items].sort(
    (a, b) =>
      TYPE_ORDER[a.mediaType] - TYPE_ORDER[b.mediaType] ||
      a.title.localeCompare(b.title, "fr"),
  );
}



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

/**
 * The date KAZEN places an item on in the calendar.
 *
 * For currently-airing anime we prefer the NEXT EPISODE air date (event-like)
 * so weekly episodes actually surface — relying on `releaseDate` alone only
 * ever showed the series premiere, hiding shows that are mid-run. Everything
 * else (unreleased anime, films, séries) falls back to `releaseDate`.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function calendarDate(it: MediaItem): string | null {
  const ep = it.nextEpisode?.airDate?.slice(0, 10);
  if (ep && ISO_DATE.test(ep)) return ep;
  const rel = it.releaseDate?.slice(0, 10);
  return rel && ISO_DATE.test(rel) ? rel : null;
}

type StatusFilter = MediaType | "all";
type WatchFilter = WatchStatus | "all" | "tracked" | "untracked";

function CalendarPage() {
  const { data: upcoming } = useSuspenseQuery(upcomingAllQO);
  const { data: series } = useSuspenseQuery(onAirSeriesQO);
  const { data: trending } = useSuspenseQuery(trendingAnimeQO);
  const { data: popular } = useSuspenseQuery(popularAnimeQO);
  const userList = useUserList();
  const { user } = useAuth();


  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [weeks, setWeeks] = useState<1 | 2>(2);
  const [type, setType] = useState<StatusFilter>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [watch, setWatch] = useState<WatchFilter>("all");

  // Merge sources and de-dupe by key. Trending/popular anime carry the airing
  // `nextEpisode`, so when the same title also appears in another source we keep
  // the variant that has an episode air date (the calendar-relevant one).
  const all = useMemo<MediaItem[]>(() => {
    const map = new Map<string, MediaItem>();
    for (const it of [...trending, ...popular, ...upcoming, ...series]) {
      const existing = map.get(it.key);
      if (!existing) {
        map.set(it.key, it);
      } else if (!existing.nextEpisode?.airDate && it.nextEpisode?.airDate) {
        map.set(it.key, it);
      }
    }
    return [...map.values()];
  }, [trending, popular, upcoming, series]);

  const availablePlatforms = useMemo(() => {
    const ids = new Set<string>();
    for (const it of all) for (const p of it.platforms) ids.add(p.id);
    return PLATFORMS.filter((p) => ids.has(p.id));
  }, [all]);

  const days = useMemo(
    () =>
      Array.from({ length: weeks * 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart, weeks],
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
    for (const [k, arr] of map) map.set(k, sortEntries(arr));
    return map;
  }, [filtered]);


  const todayIso = isoDay(new Date());
  const weekEnd = days[days.length - 1];
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
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-border bg-background/40 p-0.5">
            {([1, 2] as const).map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={weeks === w}
                onClick={() => setWeeks(w)}
                className={cn(
                  "focus-ring rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  weeks === w ? "aurora-bg text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {w === 1 ? "1 sem." : "2 sem."}
              </button>
            ))}
          </div>
          <Button variant="premium" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            <CalendarDays className="mr-1 h-4 w-4" /> Cette semaine
          </Button>
        </div>
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
          {user ? (
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
          ) : (
            <SignInFilterPrompt />
          )}
        </div>
      </div>

      {/* Legend + result count */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {TYPE_LEGEND.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", TYPE_DOT[t])} />
              {MEDIA_TYPE_LABELS[t]}
            </span>
          ))}
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {filtered.length} sortie{filtered.length > 1 ? "s" : ""} sur {weeks === 1 ? "1 semaine" : "2 semaines"}
        </span>
      </div>

      {/* Weekly grid — one labelled block per week for clear separation */}
      {filtered.length ? (
        <div className="space-y-6">
          {Array.from({ length: weeks }).map((_, wi) => {
            const weekDays = days.slice(wi * 7, wi * 7 + 7);
            const wStart = weekDays[0];
            const wEnd = weekDays[6];
            const weekCount = weekDays.reduce((n, d) => n + (byDay.get(isoDay(d))?.length ?? 0), 0);
            return (
              <section key={isoDay(wStart)}>
                {weeks > 1 ? (
                  <div className="mb-2 flex items-baseline justify-between px-1">
                    <h2 className="font-display text-sm font-bold capitalize text-foreground/90">
                      Semaine du {weekLabelFmt.format(wStart)}
                      <span className="text-muted-foreground"> – {weekLabelFmt.format(wEnd)}</span>
                    </h2>
                    <span className="text-[0.7rem] font-medium text-muted-foreground">
                      {weekCount} sortie{weekCount > 1 ? "s" : ""}
                    </span>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
                  {weekDays.map((d, i) => {
                    const key = isoDay(d);
                    const items = byDay.get(key) ?? [];
                    const isToday = key === todayIso;
                    const isPast = key < todayIso;
                    return (
                      <div
                        key={key}
                        className={cn(
                          "flex min-h-40 flex-col rounded-2xl border p-2 transition-opacity",
                          isToday
                            ? "border-primary/50 bg-primary/5"
                            : "border-border bg-card/40",
                          isPast && !isToday && "opacity-55",
                        )}
                      >
                        <div className="mb-2 flex items-baseline justify-between px-1">
                          <span className={cn("text-xs font-bold uppercase", isToday ? "text-primary" : "text-muted-foreground")}>
                            {DAY_LABELS[i % 7]}
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
              </section>
            );
          })}
        </div>
      ) : (

        <EmptyState message="Aucune sortie cette semaine avec ces filtres." hint="Changez de semaine ou réinitialisez les filtres." />
      )}
    </AppShell>
  );
}

function SignInFilterPrompt() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filtrer par mes suivis — connexion requise"
          className="focus-ring flex h-9 w-40 items-center justify-between gap-2 rounded-md border border-border bg-background/40 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="truncate">Mes suivis</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl aurora-bg text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold">Filtre par tes suivis</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Connecte-toi pour filtrer le calendrier selon tes listes : à voir,
              en cours, terminé et plus encore.
            </p>
          </div>
        </div>
        <Button asChild variant="aurora" size="sm" className="mt-3 w-full">
          <Link to="/auth">Se connecter</Link>
        </Button>
      </PopoverContent>
    </Popover>
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
        <SafeImage src={item.posterUrl} alt={`Affiche de ${item.title}`} variant="poster" fallbackLabel={item.title} loading="lazy" className="h-full w-full object-cover" />
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
