import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, Sparkles, Tv, Film, SlidersHorizontal, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { MediaGrid, MediaGridSkeleton } from "@/components/media/MediaGrid";
import { EmptyState } from "@/components/media/EmptyState";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { searchMediaQO } from "@/lib/queries";
import {
  availableGenres,
  filterAndSort,
  MIN_SCORE_OPTIONS,
  SORT_OPTIONS,
  type SearchFilters,
  type SortKey,
} from "@/lib/search-filters";

interface SearchParams {
  q?: string;
  sort?: SortKey;
  min?: number;
  genres?: string;
}

const SUGGESTIONS = ["Demon Slayer", "One Piece", "Dune", "The Last of Us", "Frieren", "Oppenheimer"];
const SORT_KEYS = new Set<SortKey>(SORT_OPTIONS.map((o) => o.key));

export const Route = createFileRoute("/recherche")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" && search.q.length ? search.q : undefined,
    sort:
      typeof search.sort === "string" && SORT_KEYS.has(search.sort as SortKey)
        ? (search.sort as SortKey)
        : undefined,
    min: typeof search.min === "number" && search.min > 0 ? search.min : undefined,
    genres: typeof search.genres === "string" && search.genres.length ? search.genres : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Recherche — KAZEN" },
      { name: "description", content: "Recherchez parmi les anime, séries et films de KAZEN." },
      { property: "og:title", content: "Recherche — KAZEN" },
      { property: "og:description", content: "Recherchez parmi les anime, séries et films de KAZEN." },
      { property: "og:url", content: "https://kazen.lovable.app/recherche" },
    ],
    links: [{ rel: "canonical", href: "https://kazen.lovable.app/recherche" }],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q: initialQ, sort, min, genres: genresParam } = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState(initialQ ?? "");

  useEffect(() => {
    setQ(initialQ ?? "");
  }, [initialQ]);

  const { data, isFetching } = useQuery(searchMediaQO(q));
  const trimmed = q.trim();

  const filters: SearchFilters = useMemo(
    () => ({
      sort: sort ?? "pertinence",
      minScore: min ?? 0,
      genres: genresParam ? genresParam.split(",").filter(Boolean) : [],
    }),
    [sort, min, genresParam],
  );

  const genreOptions = useMemo(
    () => availableGenres(data?.anime, data?.series, data?.movies),
    [data],
  );

  const filtered = useMemo(() => {
    const apply = (list?: import("@/lib/media-types").MediaItem[]) =>
      filterAndSort(list ?? [], filters, trimmed);
    return {
      anime: apply(data?.anime),
      series: apply(data?.series),
      movies: apply(data?.movies),
    };
  }, [data, filters, trimmed]);

  const counts = {
    anime: filtered.anime.length,
    series: filtered.series.length,
    movies: filtered.movies.length,
  };
  const total = counts.anime + counts.series + counts.movies;
  const filtersActive = filters.genres.length > 0 || filters.minScore > 0 || filters.sort !== "pertinence";

  const updateSearch = (patch: Partial<SearchParams>) => {
    navigate({
      to: "/recherche",
      search: (prev: SearchParams) => ({ ...prev, ...patch }),
      replace: true,
    });
  };

  const onChangeQuery = (value: string) => {
    setQ(value);
    navigate({
      to: "/recherche",
      search: (prev: SearchParams) => ({ ...prev, q: value.trim() || undefined }),
      replace: true,
    });
  };


  const toggleGenre = (g: string) => {
    const next = filters.genres.includes(g)
      ? filters.genres.filter((x) => x !== g)
      : [...filters.genres, g];
    updateSearch({ genres: next.length ? next.join(",") : undefined });
  };

  const resetFilters = () =>
    updateSearch({ genres: undefined, min: undefined, sort: undefined });

  return (
    <AppShell>
      <PageHeader title="Recherche" description="Trouvez un anime, une série ou un film en un instant." />

      <div className="relative mb-6 max-w-2xl">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => onChangeQuery(e.target.value)}
          placeholder="Rechercher un titre…"
          aria-label="Rechercher un titre"
          className="h-14 rounded-2xl pl-12 text-base"
        />
      </div>

      {trimmed.length < 2 ? (
        <div className="max-w-2xl space-y-4">
          <p className="text-sm font-semibold text-muted-foreground">Suggestions populaires</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChangeQuery(s)}
                className="focus-ring hover-lift rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium text-foreground backdrop-blur hover:border-primary/40"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="mt-8">
            <EmptyState message="Saisissez au moins 2 caractères pour lancer une recherche." />
          </div>
        </div>
      ) : isFetching && !data ? (
        <MediaGridSkeleton />
      ) : (data && total === 0 && !filtersActive) ? (
        <EmptyState
          message={`Aucun résultat pour « ${trimmed} ».`}
          hint="Essayez un autre titre ou une autre orthographe."
        />
      ) : (
        <>
          {/* Filter & sort toolbar */}
          <div className="mb-6 space-y-4 rounded-2xl border border-border bg-card/50 p-4 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <SlidersHorizontal className="h-4 w-4 text-primary" /> Affiner
              </span>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="hidden sm:inline">Trier par</span>
                <select
                  value={filters.sort}
                  onChange={(e) => updateSearch({ sort: e.target.value as SortKey })}
                  className="focus-ring rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground"
                  aria-label="Trier les résultats"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="hidden sm:inline">Note</span>
                <select
                  value={filters.minScore}
                  onChange={(e) => updateSearch({ min: Number(e.target.value) || undefined })}
                  className="focus-ring rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground"
                  aria-label="Note minimale"
                >
                  {MIN_SCORE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <span className="ml-auto text-sm font-medium text-muted-foreground">
                {total} résultat{total > 1 ? "s" : ""}
              </span>

              {filtersActive ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="focus-ring inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" /> Réinitialiser
                </button>
              ) : null}
            </div>

            {genreOptions.length ? (
              <div className="flex flex-wrap gap-2">
                {genreOptions.map((g) => {
                  const on = filters.genres.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGenre(g)}
                      aria-pressed={on}
                      className={cn(
                        "focus-ring rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                        on
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {total === 0 ? (
            <EmptyState
              message="Aucun résultat avec ces filtres."
              hint="Essayez d'élargir la note ou de retirer un genre."
            />
          ) : (
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">Tout ({total})</TabsTrigger>
                <TabsTrigger value="anime" disabled={!counts.anime}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Anime ({counts.anime})
                </TabsTrigger>
                <TabsTrigger value="series" disabled={!counts.series}>
                  <Tv className="mr-1.5 h-3.5 w-3.5" /> Séries ({counts.series})
                </TabsTrigger>
                <TabsTrigger value="movies" disabled={!counts.movies}>
                  <Film className="mr-1.5 h-3.5 w-3.5" /> Films ({counts.movies})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-6 space-y-12">
                <ResultSection title="Anime" to="/anime" items={filtered.anime} />
                <ResultSection title="Séries" to="/series" items={filtered.series} />
                <ResultSection title="Films" to="/films" items={filtered.movies} />
              </TabsContent>
              <TabsContent value="anime" className="mt-6">
                <MediaGrid items={filtered.anime} />
              </TabsContent>
              <TabsContent value="series" className="mt-6">
                <MediaGrid items={filtered.series} />
              </TabsContent>
              <TabsContent value="movies" className="mt-6">
                <MediaGrid items={filtered.movies} />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </AppShell>
  );
}

function ResultSection({
  title,
  to,
  items,
}: {
  title: string;
  to: string;
  items: import("@/lib/media-types").MediaItem[];
}) {
  if (!items.length) return null;
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        <Link to={to} className="text-sm font-semibold text-primary hover:underline">
          Explorer
        </Link>
      </div>
      <MediaGrid items={items} />
    </section>
  );
}
