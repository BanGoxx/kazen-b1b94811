import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Flame,
  Heart,
  ListChecks,
  Loader2,
  Pencil,
  RotateCcw,
  StickyNote,
  Star,
  Tag as TagIcon,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MediaCard } from "@/components/media/MediaCard";
import { ListControls } from "@/components/media/ListControls";
import { PremiumHint } from "@/components/premium/PremiumHint";
import { useMyList, type ListEntry } from "@/lib/use-list";
import {
  MEDIA_TYPE_LABELS,
  PRIORITY_LABELS,
  WATCH_STATUS_LABELS,
  type MediaType,
  type WatchStatus,
} from "@/lib/media-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mes-listes")({
  head: () => ({
    meta: [
      { title: "Mes listes — KAZEN" },
      {
        name: "description",
        content: "Gérez vos anime, séries et films suivis, favoris et notes personnelles.",
      },
    ],
  }),
  component: MyListsPage,
});

const STATUS_TABS: { value: WatchStatus | "tous" | "favoris"; label: string }[] = [
  { value: "tous", label: "Tout" },
  { value: "favoris", label: "Favoris" },
  { value: "a_voir", label: WATCH_STATUS_LABELS.a_voir },
  { value: "en_cours", label: WATCH_STATUS_LABELS.en_cours },
  { value: "termine", label: WATCH_STATUS_LABELS.termine },
  { value: "en_pause", label: WATCH_STATUS_LABELS.en_pause },
  { value: "abandonne", label: WATCH_STATUS_LABELS.abandonne },
];

const TYPES: (MediaType | "tous")[] = ["tous", "anime", "series", "movie"];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "recent", label: "Récemment mis à jour" },
  { value: "note", label: "Meilleure note" },
  { value: "titre", label: "Titre (A→Z)" },
  { value: "priorite", label: "Priorité" },
];

const PRIORITY_ORDER: Record<string, number> = { haute: 0, normale: 1, basse: 2 };

function MyListsPage() {
  const { entries, isLoading } = useMyList();
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]["value"]>("tous");
  const [type, setType] = useState<MediaType | "tous">("tous");
  const [platform, setPlatform] = useState<string>("tous");
  const [tag, setTag] = useState<string>("tous");
  const [sort, setSort] = useState<string>("recent");

  const platforms = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => e.item?.platforms.forEach((p) => set.add(p.name)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [entries]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => e.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [entries]);

  const filtered = useMemo(() => {
    const list = entries.filter((e) => {
      if (tab === "favoris" && !e.favorite) return false;
      if (tab !== "tous" && tab !== "favoris" && e.status !== tab) return false;
      if (type !== "tous" && e.item?.mediaType !== type) return false;
      if (platform !== "tous" && !e.item?.platforms.some((p) => p.name === platform))
        return false;
      if (tag !== "tous" && !e.tags.includes(tag)) return false;
      return true;
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "note":
          return (b.rating ?? -1) - (a.rating ?? -1);
        case "titre":
          return (a.item?.title ?? "").localeCompare(b.item?.title ?? "", "fr");
        case "priorite":
          return (
            (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
          );
        case "recent":
        default:
          return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
      }
    });
    return sorted;
  }, [entries, tab, type, platform, tag, sort]);


  return (
    <AppShell>
      <div className="section-container space-y-8">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ListChecks className="h-4 w-4" /> Espace personnel
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            Mes <span className="aurora-text">listes</span>
          </h1>
          <p className="text-muted-foreground">
            {entries.length} titre{entries.length > 1 ? "s" : ""} suivi
            {entries.length > 1 ? "s" : ""}.
          </p>
        </header>

        <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-4 backdrop-blur">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setTab(s.value)}
                aria-pressed={tab === s.value}
                className={cn(
                  "focus-ring rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all",
                  tab === s.value
                    ? "border-transparent aurora-bg text-white shadow-[var(--shadow-glow)]"
                    : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {s.value === "favoris" ? (
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" /> {s.label}
                  </span>
                ) : (
                  s.label
                )}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={cn(
                  "focus-ring rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  type === t
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "tous" ? "Tous types" : MEDIA_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          {platforms.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">
                Plateforme
              </span>
              {["tous", ...platforms].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  aria-pressed={platform === p}
                  className={cn(
                    "focus-ring rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    platform === p
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p === "tous" ? "Toutes plateformes" : p}
                </button>
              ))}
            </div>
          ) : null}
          {tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Tags</span>
              {["tous", ...tags].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(t)}
                  aria-pressed={tag === t}
                  className={cn(
                    "focus-ring rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    tag === t
                      ? "border-accent/50 bg-accent/15 text-accent-foreground"
                      : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "tous" ? "Tous les tags" : t}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-3">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Trier par
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Trier les titres"
                className="focus-ring rounded-lg border border-border bg-background/60 px-2.5 py-1 text-xs font-semibold text-foreground"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs font-semibold text-foreground">
              {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
            </span>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">Besoin de filtres croisés&nbsp;?</span>
              <PremiumHint featureId="filters" label="Filtres avancés" />
            </div>
          </div>

        </div>


        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-20 text-center">
              <p className="font-display text-lg font-bold">Votre liste est encore vide</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Ajoutez un titre depuis n'importe quelle fiche pour le suivre, le noter et
                l'organiser avec vos tags.
              </p>
              <Button asChild variant="aurora" className="mt-5">
                <Link to="/">Découvrir des titres</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
              <p className="text-muted-foreground">Aucun titre ne correspond à ces filtres.</p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {filtered.map((entry) => (
              <ListEntryCard key={entry.mediaKey} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ListEntryCard({ entry }: { entry: ListEntry }) {
  const [open, setOpen] = useState(false);
  if (!entry.item) return null;

  return (
    <div className="space-y-2">
      <div className="relative">
        <MediaCard item={entry.item} />
        {entry.favorite ? (
          <span className="absolute right-2 top-2 rounded-full bg-rose-500/90 p-1.5 text-white shadow">
            <Heart className="h-3.5 w-3.5 fill-current" />
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {entry.status ? (
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
              {WATCH_STATUS_LABELS[entry.status]}
            </span>
          ) : null}
          {entry.rating ? (
            <span className="inline-flex items-center gap-0.5 font-medium text-amber-400">
              <Star className="h-3 w-3 fill-current" /> {entry.rating}
            </span>
          ) : null}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Modifier">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="line-clamp-1">{entry.item.title}</DialogTitle>
            </DialogHeader>
            <ListControls item={entry.item} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
