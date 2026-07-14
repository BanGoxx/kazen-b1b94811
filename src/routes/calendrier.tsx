import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { EmptyState } from "@/components/media/EmptyState";
import { SafeImage } from "@/components/media/SafeImage";
import type { MediaItem, MediaType, WatchStatus } from "@/lib/media-types";
import { MEDIA_TYPE_LABELS, WATCH_STATUS_LABELS } from "@/lib/media-types";
import { PLATFORMS } from "@/lib/platforms";
import {
  upcomingAllQO,
  onAirSeriesQO,
  trendingAnimeQO,
  popularAnimeQO,
  seasonalAnimeQO,
  refreshAnimeRails,
  upgradeCatalogOnce,
} from "@/lib/queries";
import { useMyList } from "@/lib/use-list";
import { useEmailPreferences } from "@/lib/use-digest";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
    // (not just premieres) can populate the grid. Seasonal covers the full
    // airing season (far beyond the ~60 trending/popular titles), which is the
    // main lever for anime completeness in the calendar.
    void context.queryClient.prefetchQuery(trendingAnimeQO);
    void context.queryClient.prefetchQuery(popularAnimeQO);
    void context.queryClient.prefetchQuery(seasonalAnimeQO());
  },
  component: CalendarPage,
  pendingComponent: () => (
    <AppShell>
      <PageHeader title="Calendrier" description="Les sorties de la semaine, jour par jour." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">

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

/** A catalog item placed on a concrete calendar day, with optional episode info. */
interface PlacedItem {
  item: MediaItem;
  date: string;
  epNumber: number | null;
  missed: boolean;
}

function sortEntries(items: PlacedItem[]): PlacedItem[] {
  return [...items].sort(
    (a, b) =>
      TYPE_ORDER[a.item.mediaType] - TYPE_ORDER[b.item.mediaType] ||
      a.item.title.localeCompare(b.item.title, "fr"),
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
 *
 * Episode air dates come back as full UTC ISO timestamps; naive `.slice(0,10)`
 * would drop a late-evening episode onto the previous UTC day. We normalize to
 * the Europe/Paris civil day (the timezone KAZEN uses everywhere for airing
 * info) so episodes land on the day members actually expect. Film/série
 * `releaseDate` values are date-only (no time), so they stay timezone-neutral.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PARIS_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function calendarDate(it: MediaItem): string | null {
  const ep = it.nextEpisode?.airDate;
  if (ep) {
    const d = new Date(ep);
    if (!Number.isNaN(d.getTime())) return PARIS_DAY.format(d);
  }
  const rel = it.releaseDate?.slice(0, 10);
  return rel && ISO_DATE.test(rel) ? rel : null;
}

/**
 * Missed-episode reasoning for a tracked, currently-watching title.
 *
 * We only know the NEXT episode (number + air date) from the provider — not
 * the full per-episode schedule. From that we derive the latest episode that
 * has ALREADY aired: if the "next" episode's air date is in the past it is
 * itself the latest aired one, otherwise the latest aired is the previous
 * number. A title counts as "missed" only when ALL of these hold — otherwise
 * we stay silent rather than guess:
 *  - reliable progress exists (not null);
 *  - the next-episode number is a real positive integer;
 *  - member progress is strictly behind the latest aired episode.
 */
function missedInfo(
  it: MediaItem,
  progress: number | null,
): { missed: boolean; latestAired: number | null } {
  const n = it.nextEpisode?.number;
  const airRaw = it.nextEpisode?.airDate;
  if (progress == null || !airRaw || !n || !(n > 0)) {
    return { missed: false, latestAired: null };
  }
  const airMs = new Date(airRaw).getTime();
  if (Number.isNaN(airMs)) return { missed: false, latestAired: null };
  const latestAired = airMs <= Date.now() ? n : n - 1;
  if (latestAired < 1) return { missed: false, latestAired: null };
  return { missed: progress < latestAired, latestAired };
}

/**
 * Best-effort placement day for a MISSED episode. Providers only expose the
 * NEXT episode date, so:
 *  - if that next episode already aired, that is the missed episode's day;
 *  - otherwise we estimate the previous weekly slot (next − 7 days), the
 *    dominant cadence for airing anime. This is explicitly an estimate and is
 *    only ever used in the "Épisodes manqués" mode.
 */
function missedPlacementDate(it: MediaItem): string | null {
  const airRaw = it.nextEpisode?.airDate;
  if (!airRaw) return null;
  const d = new Date(airRaw);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() > Date.now()) d.setDate(d.getDate() - 7);
  return PARIS_DAY.format(d);
}

type StatusFilter = MediaType | "all";
type WatchFilter =
  | "all"
  | "tracked"
  | "untracked"
  | "favoris"
  | "upcoming_ep"
  | "missed_ep"
  | "my_platforms"
  | "preferred_genres"
  | WatchStatus;

function normGenre(g: string): string {
  return g.trim().toLowerCase();
}

function CalendarPage() {
  const { data: upcoming } = useSuspenseQuery(upcomingAllQO);
  const { data: series } = useSuspenseQuery(onAirSeriesQO);
  const { data: trending } = useSuspenseQuery(trendingAnimeQO);
  const { data: popular } = useSuspenseQuery(popularAnimeQO);
  const { data: seasonal } = useSuspenseQuery(seasonalAnimeQO());
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Authenticated, RLS-scoped personal tracking. `useMyList` reads ONLY the
  // signed-in member's own `list_items` server-side (server identity, no
  // client-supplied user id) and is empty for anonymous visitors, so the
  // public calendar is unchanged for them. It shares the ["my-list"] query key
  // that list mutations invalidate, so personal modes refresh immediately
  // after any tracking change.
  const { entries } = useMyList();
  const personal = useMemo(() => {
    const m = new Map<string, { status: WatchStatus | null; favorite: boolean; progress: number | null }>();
    for (const e of entries) {
      m.set(e.mediaKey, { status: e.status, favorite: e.favorite, progress: e.progress });
    }
    return m;
  }, [entries]);

  // Private, server-side platform/genre preferences (member_email_preferences,
  // RLS-scoped, never exposed on public profiles). Reused here so a member can
  // filter the calendar by the platforms/genres they already declared.
  const { data: emailPrefs } = useEmailPreferences();
  const preferredPlatforms = useMemo(
    () => new Set(emailPrefs?.preferred_platforms ?? []),
    [emailPrefs],
  );
  const preferredGenres = useMemo(
    () => new Set((emailPrefs?.preferred_genres ?? []).map(normGenre)),
    [emailPrefs],
  );

  // Post-hydration browser-direct upgrade. On the server the Worker is often
  // AniList-blocked, so the dehydrated anime data can be a curated fallback.
  // Upgrade each anime source to the real browser-direct list exactly ONCE per
  // session (bounded, rate-limit friendly) so the calendar isn't thin.
  useEffect(() => {
    refreshAnimeRails(queryClient);
    upgradeCatalogOnce(queryClient, ["upcoming", "all"]);
  }, [queryClient]);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [weeks, setWeeks] = useState<1 | 2 | 4>(2);
  const [type, setType] = useState<StatusFilter>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [watch, setWatch] = useState<WatchFilter>("all");

  // Merge sources and de-dupe by canonical key. Trending/popular/seasonal anime
  // carry the airing `nextEpisode`; seasonal is the widest airing set, so it
  // fills the many days the ~60 trending/popular titles leave empty. When the
  // same title appears in several sources we keep the variant that has an
  // episode air date (the calendar-relevant one). Dedup is key-exact, so
  // unrelated titles are never merged.
  const all = useMemo<MediaItem[]>(() => {
    const map = new Map<string, MediaItem>();
    for (const it of [...trending, ...popular, ...seasonal.items, ...upcoming, ...series]) {
      const existing = map.get(it.key);
      if (!existing) {
        map.set(it.key, it);
      } else if (!existing.nextEpisode?.airDate && it.nextEpisode?.airDate) {
        map.set(it.key, it);
      }
    }
    return [...map.values()];
  }, [trending, popular, seasonal, upcoming, series]);

  // Honest degradation signal: if every anime source came back empty, the
  // provider is temporarily unreachable — surface a subtle, non-alarmist hint
  // rather than implying "no anime releases exist".
  const animeDegraded =
    trending.length === 0 && popular.length === 0 && seasonal.items.length === 0;


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

  const todayIso = isoDay(new Date());

  // Personal-mode set that requires the member to be tracking the title.
  const trackedModes: WatchFilter[] = ["tracked", "upcoming_ep", "missed_ep"];
  const statusModes: WatchStatus[] = Object.keys(WATCH_STATUS_LABELS) as WatchStatus[];

  // Single pass: apply base (type/platform) + personal filters and resolve the
  // day each item is placed on. Missed mode overrides the placement date with
  // the missed episode's (estimated) day.
  const placed = useMemo<PlacedItem[]>(() => {
    const weekKeys = new Set(days.map(isoDay));
    const out: PlacedItem[] = [];
    for (const it of all) {
      if (type !== "all" && it.mediaType !== type) continue;
      if (platform !== "all" && !it.platforms.some((p) => p.id === platform)) continue;

      const entry = personal.get(it.key);
      let date = calendarDate(it);
      let epNumber: number | null = null;
      let missed = false;

      // Episode number surfaced only when the item sits on its next-episode day.
      const epDay = it.nextEpisode?.airDate ? PARIS_DAY.format(new Date(it.nextEpisode.airDate)) : null;
      if (epDay && epDay === date && Number.isFinite(it.nextEpisode!.number) && it.nextEpisode!.number > 0) {
        epNumber = it.nextEpisode!.number;
      }

      if (user && watch !== "all") {
        if (watch === "untracked") {
          if (entry) continue;
        } else if (watch === "tracked") {
          if (!entry) continue;
        } else if (watch === "favoris") {
          if (!entry?.favorite) continue;
        } else if (watch === "my_platforms") {
          if (preferredPlatforms.size === 0) continue;
          if (!it.platforms.some((p) => preferredPlatforms.has(p.id))) continue;
        } else if (watch === "preferred_genres") {
          if (preferredGenres.size === 0) continue;
          if (!(it.genres ?? []).some((g) => preferredGenres.has(normGenre(g)))) continue;
        } else if (watch === "upcoming_ep") {
          if (!entry) continue;
          const ep = it.nextEpisode?.airDate;
          if (!ep) continue;
          const epKey = PARIS_DAY.format(new Date(ep));
          if (epKey < todayIso) continue; // only genuinely upcoming episodes
        } else if (watch === "missed_ep") {
          if (entry?.status !== "en_cours") continue;
          const mi = missedInfo(it, entry.progress);
          if (!mi.missed) continue;
          date = missedPlacementDate(it);
          epNumber = mi.latestAired;
          missed = true;
        } else if (statusModes.includes(watch as WatchStatus)) {
          if (entry?.status !== watch) continue;
        }
      }

      if (!date || !weekKeys.has(date)) continue;
      out.push({ item: it, date, epNumber, missed });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, days, type, platform, watch, personal, user, preferredPlatforms, preferredGenres, todayIso]);

  const byDay = useMemo(() => {
    const map = new Map<string, PlacedItem[]>();
    for (const p of placed) {
      const arr = map.get(p.date) ?? [];
      arr.push(p);
      map.set(p.date, arr);
    }
    for (const [k, arr] of map) map.set(k, sortEntries(arr));
    return map;
  }, [placed]);


  const weekEnd = days[days.length - 1];
  const rangeLabel = `${rangeFmt.format(weekStart)} – ${rangeFmt.format(weekEnd)} ${weekEnd.getFullYear()}`;

  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + delta * 7);
    setWeekStart(d);
  };

  // Empty-state hint tailored to a personal mode that relies on preferences.
  const personalPrefsMissing =
    (watch === "my_platforms" && preferredPlatforms.size === 0) ||
    (watch === "preferred_genres" && preferredGenres.size === 0);

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
            {([1, 2, 4] as const).map((w) => (
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
                {w} sem.
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
              <SelectTrigger className="h-9 w-44" aria-label="Mode calendrier personnel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tout</SelectItem>
                <SelectGroup>
                  <SelectLabel>Ma liste</SelectLabel>
                  <SelectItem value="tracked">Dans ma liste</SelectItem>
                  <SelectItem value="untracked">Hors liste</SelectItem>
                  <SelectItem value="favoris">Favoris</SelectItem>
                  <SelectItem value="upcoming_ep">Épisodes à venir</SelectItem>
                  <SelectItem value="missed_ep">Épisodes manqués</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Préférences</SelectLabel>
                  <SelectItem value="my_platforms">Mes plateformes</SelectItem>
                  <SelectItem value="preferred_genres">Genres préférés</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Statut</SelectLabel>
                  {statusModes.map((s) => (
                    <SelectItem key={s} value={s}>{WATCH_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectGroup>
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
          {placed.length} sortie{placed.length > 1 ? "s" : ""} sur {weeks} semaine{weeks > 1 ? "s" : ""}
        </span>
      </div>

      {animeDegraded ? (
        <div
          role="status"
          className="mb-4 rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-[0.72rem] text-muted-foreground"
        >
          Certaines données anime peuvent être limitées temporairement.
        </div>
      ) : null}

      {watch === "missed_ep" && user ? (
        <div
          role="note"
          className="mb-4 rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-[0.72rem] text-muted-foreground"
        >
          Rattrapage : titres « en cours » dont votre progression est en retard sur
          le dernier épisode diffusé. Le jour affiché est estimé (cadence
          hebdomadaire) faute de planning épisode par épisode.
        </div>
      ) : null}

      {/* Weekly grid — one labelled block per week for clear separation */}
      {placed.length ? (
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                  {weekDays.map((d, i) => {
                    const key = isoDay(d);
                    return (
                      <DayCell
                        key={key}
                        dayLabel={DAY_LABELS[i % 7]}
                        date={d}
                        items={byDay.get(key) ?? []}
                        isToday={key === todayIso}
                        isPast={key < todayIso}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (

        <EmptyState
          message={
            personalPrefsMissing
              ? "Aucune préférence enregistrée pour ce filtre."
              : "Aucune sortie sur cette période avec ces filtres."
          }
          hint={
            personalPrefsMissing
              ? "Renseignez vos plateformes ou genres dans vos préférences pour utiliser ce mode."
              : "Changez de période ou réinitialisez les filtres."
          }
        />
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
              Connecte-toi pour personnaliser le calendrier selon tes listes :
              ma liste, en cours, favoris, plateformes, épisodes à venir ou
              manqués.
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

// Show a bounded number of entries per day; busy days expand inline via a
// "voir plus" toggle so columns stay scannable and never overlap.
const DAY_VISIBLE = 4;

function DayCell({
  dayLabel,
  date,
  items,
  isToday,
  isPast,
}: {
  dayLabel: string;
  date: Date;
  items: PlacedItem[];
  isToday: boolean;
  isPast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const overflow = items.length - DAY_VISIBLE;
  const shown = expanded ? items : items.slice(0, DAY_VISIBLE);
  return (
    <div
      className={cn(
        "flex min-h-40 flex-col rounded-2xl border p-2 transition-opacity",
        isToday ? "border-primary/50 bg-primary/5" : "border-border bg-card/40",
        isPast && !isToday && "opacity-55",
      )}
    >
      <div className="mb-2 flex items-baseline justify-between px-1">
        <span className={cn("text-xs font-bold uppercase", isToday ? "text-primary" : "text-muted-foreground")}>
          {dayLabel}
        </span>
        <span className={cn("text-lg font-extrabold", isToday && "text-primary")}>{date.getDate()}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {items.length ? (
          <>
            {shown.map((p) => (
              <CalendarEntry key={p.item.key} placed={p} />
            ))}
            {overflow > 0 ? (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
                className="focus-ring mt-0.5 rounded-lg border border-border/60 bg-background/40 px-2 py-1 text-[0.7rem] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {expanded ? "Voir moins" : `+${overflow} de plus`}
              </button>
            ) : null}
          </>
        ) : (
          <span className="flex flex-1 items-center justify-center px-1 py-6 text-center text-[0.7rem] text-muted-foreground/60">
            Aucune sortie
          </span>
        )}
      </div>
    </div>
  );
}


function CalendarEntry({ placed }: { placed: PlacedItem }) {
  const { item, epNumber, missed } = placed;
  const epLabel = epNumber && epNumber > 0 ? `Ép. ${epNumber}${missed ? " manqué" : ""}` : null;
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
        {epLabel ? (
          <span className={cn("truncate text-[0.65rem] font-semibold", missed ? "text-destructive" : "text-primary")}>
            {epLabel}
            {item.platforms[0] ? <span className="font-normal text-muted-foreground"> · {item.platforms[0].name}</span> : null}
          </span>
        ) : item.platforms[0] ? (
          <span className="truncate text-[0.65rem] text-muted-foreground">{item.platforms[0].name}</span>
        ) : (
          <span className="text-[0.65rem] text-muted-foreground">{MEDIA_TYPE_LABELS[item.mediaType]}</span>
        )}
      </div>
    </Link>
  );
}
