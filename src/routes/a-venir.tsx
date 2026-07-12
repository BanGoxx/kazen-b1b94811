import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { MediaGrid, MediaGridSkeleton } from "@/components/media/MediaGrid";
import { EmptyState } from "@/components/media/EmptyState";
import { SlowLoadHint } from "@/components/media/LoadingHint";
import { SafeImage } from "@/components/media/SafeImage";
import type { MediaItem, MediaType } from "@/lib/media-types";
import { MEDIA_TYPE_LABELS } from "@/lib/media-types";
import { PLATFORMS } from "@/lib/platforms";
import { upcomingAllQO, upgradeCatalogOnce } from "@/lib/queries";
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
      { property: "og:title", content: "À venir — KAZEN" },
      { property: "og:description", content: "Toutes les prochaines sorties anime, séries et films, classées par date de sortie." },
      { property: "og:url", content: "https://kazen.lovable.app/a-venir" },
    ],
    links: [{ rel: "canonical", href: "https://kazen.lovable.app/a-venir" }],
  }),
  loader: async ({ context }) => {
    void context.queryClient.ensureQueryData(upcomingAllQO);
  },
  component: UpcomingPage,
  pendingComponent: () => (
    <AppShell>
      <PageHeader title="Sorties à venir" description="Anime, séries et films attendus, du plus proche au plus lointain." />
      <div className="mb-6">
        <SlowLoadHint />
      </div>
      <MediaGridSkeleton count={10} />
    </AppShell>
  ),
});

type Filter = MediaType | "all";
type SortOrder = "soon" | "later" | "popular";

const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

const TODAY = new Date();
const TODAY_ISO = TODAY.toISOString().slice(0, 10);

/** Whole days between today and an ISO date (negative = past). */
function daysUntil(iso: string): number {
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const base = new Date(`${TODAY_ISO}T00:00:00`);
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

/** Short human countdown, e.g. "Aujourd'hui", "Demain", "Dans 5 j". */
function countdownLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d <= 0) return "Aujourd'hui";
  if (d === 1) return "Demain";
  if (d < 7) return `Dans ${d} j`;
  if (d < 14) return "La semaine prochaine";
  return `Dans ${Math.round(d / 7)} sem.`;
}

/** Relative descriptor for a month key vs the current month. */
function monthContext(key: string): string | null {
  const nowKey = TODAY_ISO.slice(0, 7);
  if (key === nowKey) return "Ce mois-ci";
  const [ny, nm] = nowKey.split("-").map(Number);
  const [ky, km] = key.split("-").map(Number);
  const diff = (ky - ny) * 12 + (km - nm);
  if (diff === 1) return "Le mois prochain";
  return null;
}

// KAZEN reste anime-first : à date égale, l'anime passe devant.
const TYPE_ORDER: Record<MediaType, number> = { anime: 0, series: 1, movie: 2 };
function byTypePriority(a: MediaItem, b: MediaItem): number {
  return TYPE_ORDER[a.mediaType] - TYPE_ORDER[b.mediaType];
}

const SORT_LABELS: Record<SortOrder, string> = {
  soon: "Les plus proches",
  later: "Les plus lointaines",
  popular: "Les plus populaires",
};

const TYPE_DOT: Record<MediaType, string> = {
  anime: "bg-primary",
  series: "bg-accent",
  movie: "bg-chart-3",
};

/** Compact card with a countdown pill, used in the "Bientôt" spotlight. */
function SpotlightCard({ item }: { item: MediaItem }) {
  const iso = item.releaseDate!;
  const soon = daysUntil(iso) <= 1;
  return (
    <Link
      to="/media/$source/$id"
      params={{ source: item.source, id: item.externalId }}
      className="group card-elevated relative block w-36 shrink-0 overflow-hidden rounded-2xl border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-40"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        <SafeImage
          src={item.posterUrl}
          alt={item.title}
          variant="poster"
          fallbackLabel={item.title}
          loading="lazy"
          decoding="async"
          width={300}
          height={450}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span
          className={cn(
            "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide shadow-sm backdrop-blur-sm",
            soon ? "aurora-bg text-white" : "bg-card/85 text-foreground",
          )}
        >
          {countdownLabel(iso)}
        </span>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/70 to-transparent" />
      </div>
      <div className="space-y-0.5 p-2.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-card-foreground transition-colors group-hover:text-primary">
          {item.title}
        </h3>
        <p className="text-xs capitalize text-muted-foreground">{dayFmt.format(new Date(`${iso}T00:00:00`))}</p>
      </div>
    </Link>
  );
}

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

  // Server already curates genuinely-upcoming titles; we no longer drop items
  // that lack a precise date (many announced anime only have a year/season).
  const visible = useMemo(
    () =>
      data
        .filter((it) => filter === "all" || it.mediaType === filter)
        .filter((it) => platform === "all" || it.platforms.some((p) => p.id === platform)),
    [data, filter, platform],
  );

  // "Bientôt" : titres datés dans les 14 prochains jours, anime en premier.
  const spotlight = useMemo(() => {
    if (sort !== "soon") return [];
    return visible
      .filter((it) => it.releaseDate && it.releaseDate >= TODAY_ISO && daysUntil(it.releaseDate) <= 14)
      .sort((a, b) => {
        const cmp = a.releaseDate! < b.releaseDate! ? -1 : a.releaseDate! > b.releaseDate! ? 1 : 0;
        return cmp !== 0 ? cmp : byTypePriority(a, b);
      })
      .slice(0, 12);
  }, [visible, sort]);

  // For the popular sort we render a flat grid; for date sorts we group by month.
  const grouped = sort !== "popular";

  const flat = useMemo(
    () =>
      [...visible].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [visible],
  );

  const groups = useMemo(() => {
    // Titles with a concrete future date are grouped by month; those with a
    // partial/missing date land in a "date à confirmer" bucket shown last.
    const scheduled = visible.filter((it) => it.releaseDate && it.releaseDate >= TODAY_ISO);
    const tbc = visible.filter((it) => !(it.releaseDate && it.releaseDate >= TODAY_ISO));
    const sorted = [...scheduled].sort((a, b) => {
      const cmp = a.releaseDate! < b.releaseDate! ? -1 : a.releaseDate! > b.releaseDate! ? 1 : 0;
      const dateCmp = sort === "later" ? -cmp : cmp;
      // À date égale : anime d'abord (règle KAZEN anime-first).
      return dateCmp !== 0 ? dateCmp : byTypePriority(a, b);
    });
    const map = new Map<string, MediaItem[]>();
    for (const it of sorted) {
      const key = monthKey(it.releaseDate!);
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    const entries = Array.from(map.entries());
    if (tbc.length) entries.push(["tbc", tbc]);
    return entries;
  }, [visible, sort]);

  return (
    <AppShell>
      <PageHeader
        title="Sorties à venir"
        description="Anime, séries et films attendus, du plus proche au plus lointain."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
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

      {/* Récap : total + légende des types */}
      <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          {visible.length} sortie{visible.length > 1 ? "s" : ""}
        </span>
        {(["anime", "series", "movie"] as MediaType[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", TYPE_DOT[t])} aria-hidden="true" />
            {MEDIA_TYPE_LABELS[t]}
          </span>
        ))}
      </div>

      {visible.length ? (
        <>
          {spotlight.length ? (
            <section className="mb-12" aria-labelledby="spotlight-title">
              <div className="mb-4 flex items-center gap-2.5">
                <CalendarClock className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 id="spotlight-title" className="font-display text-xl font-bold">
                  Bientôt disponible
                </h2>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                  14 prochains jours
                </span>
              </div>
              <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
                {spotlight.map((item) => (
                  <div key={item.key} className="snap-start">
                    <SpotlightCard item={item} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {grouped ? (
            <div className="space-y-12">
              {groups.map(([key, items]) => {
                const ctx = key === "tbc" ? null : monthContext(key);
                return (
                  <section key={key}>
                    <div className="mb-4 flex items-center gap-3">
                      <h2 className="font-display text-xl font-bold capitalize">
                        {key === "tbc"
                          ? "Date à confirmer"
                          : monthFmt.format(new Date(`${key}-01T00:00:00`))}
                      </h2>
                      {ctx ? (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                          {ctx}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {items.length}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <MediaGrid items={items} />
                  </section>
                );
              })}
            </div>
          ) : (
            <MediaGrid items={flat} />
          )}

          {/* Finite-state clarity: explain that the upcoming set is intentionally
              bounded (provider-safe) and refreshes on its own, so users don't
              read the finite count as a tiny/incomplete catalogue. */}
          <p className="mt-10 text-center text-xs text-muted-foreground">
            {visible.length} sortie{visible.length > 1 ? "s" : ""} affichée
            {visible.length > 1 ? "s" : ""} — les prochaines annonces
            {counts.anime ? " (dont les nouveaux anime)" : ""} seront ajoutées
            automatiquement au fil des publications AniList et TMDB.
          </p>
        </>
      ) : (
        <EmptyState message="Aucune sortie annoncée avec ces filtres." hint="Modifiez le type ou la plateforme, ou revenez bientôt." />
      )}
    </AppShell>
  );
}
