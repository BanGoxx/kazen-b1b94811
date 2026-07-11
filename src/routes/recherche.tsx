import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, SectionHeader } from "@/components/media/SectionHeader";
import { MediaGrid, MediaGridSkeleton } from "@/components/media/MediaGrid";
import { EmptyState } from "@/components/media/EmptyState";
import { Input } from "@/components/ui/input";
import { searchMediaQO } from "@/lib/queries";

export const Route = createFileRoute("/recherche")({
  head: () => ({
    meta: [
      { title: "Recherche — NEXUS MEDIA" },
      { name: "description", content: "Recherchez parmi les anime, séries et films de NEXUS MEDIA." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const { data, isFetching } = useQuery(searchMediaQO(q));
  const trimmed = q.trim();
  const total = data ? data.anime.length + data.series.length + data.movies.length : 0;

  return (
    <AppShell>
      <PageHeader title="Recherche" description="Trouvez un anime, une série ou un film en un instant." />
      <div className="relative mb-8 max-w-xl">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un titre…"
          aria-label="Rechercher un titre"
          className="h-12 pl-11 text-base"
        />
      </div>

      {trimmed.length < 2 ? (
        <EmptyState message="Saisissez au moins 2 caractères pour lancer une recherche." />
      ) : isFetching && !data ? (
        <MediaGridSkeleton />
      ) : total === 0 ? (
        <EmptyState message={`Aucun résultat pour « ${trimmed} ».`} hint="Essayez un autre titre ou une autre orthographe." />
      ) : (
        <div className="space-y-12">
          {data!.anime.length ? (
            <section>
              <SectionHeader title="Anime" />
              <MediaGrid items={data!.anime} />
            </section>
          ) : null}
          {data!.series.length ? (
            <section>
              <SectionHeader title="Séries" />
              <MediaGrid items={data!.series} />
            </section>
          ) : null}
          {data!.movies.length ? (
            <section>
              <SectionHeader title="Films" />
              <MediaGrid items={data!.movies} />
            </section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
