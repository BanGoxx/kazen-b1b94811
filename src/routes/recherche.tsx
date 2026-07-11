import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, Sparkles, Tv, Film } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { MediaGrid, MediaGridSkeleton } from "@/components/media/MediaGrid";
import { EmptyState } from "@/components/media/EmptyState";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { searchMediaQO } from "@/lib/queries";

interface SearchParams {
  q?: string;
}

const SUGGESTIONS = ["Demon Slayer", "One Piece", "Dune", "The Last of Us", "Frieren", "Oppenheimer"];

export const Route = createFileRoute("/recherche")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" && search.q.length ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Recherche — KAZEN" },
      { name: "description", content: "Recherchez parmi les anime, séries et films de KAZEN." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q: initialQ } = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState(initialQ ?? "");

  useEffect(() => {
    setQ(initialQ ?? "");
  }, [initialQ]);

  const { data, isFetching } = useQuery(searchMediaQO(q));
  const trimmed = q.trim();
  const counts = {
    anime: data?.anime.length ?? 0,
    series: data?.series.length ?? 0,
    movies: data?.movies.length ?? 0,
  };
  const total = counts.anime + counts.series + counts.movies;

  const onChange = (value: string) => {
    setQ(value);
    navigate({ to: "/recherche", search: { q: value.trim() || undefined }, replace: true });
  };

  return (
    <AppShell>
      <PageHeader title="Recherche" description="Trouvez un anime, une série ou un film en un instant." />

      <div className="relative mb-6 max-w-2xl">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => onChange(e.target.value)}
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
                onClick={() => onChange(s)}
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
      ) : total === 0 ? (
        <EmptyState
          message={`Aucun résultat pour « ${trimmed} ».`}
          hint="Essayez un autre titre ou une autre orthographe."
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
            <ResultSection title="Anime" to="/anime" items={data!.anime} />
            <ResultSection title="Séries" to="/series" items={data!.series} />
            <ResultSection title="Films" to="/films" items={data!.movies} />
          </TabsContent>
          <TabsContent value="anime" className="mt-6">
            <MediaGrid items={data!.anime} />
          </TabsContent>
          <TabsContent value="series" className="mt-6">
            <MediaGrid items={data!.series} />
          </TabsContent>
          <TabsContent value="movies" className="mt-6">
            <MediaGrid items={data!.movies} />
          </TabsContent>
        </Tabs>
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
