import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { PaginatedCatalog } from "@/components/media/PaginatedCatalog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { moviePageQO } from "@/lib/queries";

const FILM_TABS = new Set(["trending", "popular", "upcoming", "animated", "asian"]);

export const Route = createFileRoute("/films")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" && FILM_TABS.has(search.tab) ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Films — KAZEN" },
      { name: "description", content: "Films tendance, populaires, à venir et films d'animation, avec leurs plateformes de disponibilité." },
      { property: "og:title", content: "Films — KAZEN" },
      { property: "og:description", content: "Films tendance, populaires, à venir et films d'animation, avec leurs plateformes de disponibilité." },
      { property: "og:url", content: "https://kazen.lovable.app/films" },
    ],
    links: [{ rel: "canonical", href: "https://kazen.lovable.app/films" }],
  }),
  loader: async ({ context }) => {
    void context.queryClient.ensureInfiniteQueryData(moviePageQO("trending"));
  },
  component: MoviesPage,
});

function MoviesPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <AppShell>
      <PageHeader title="Films" description="Du blockbuster au film culte, sans oublier l'animation." />
      <Tabs
        value={tab ?? "trending"}
        onValueChange={(value) =>
          navigate({ to: "/films", search: { tab: value }, replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value="trending">Tendance</TabsTrigger>
          <TabsTrigger value="popular">Populaires</TabsTrigger>
          <TabsTrigger value="upcoming">À venir</TabsTrigger>
          <TabsTrigger value="animated">Animation</TabsTrigger>
          <TabsTrigger value="asian">Animation asiatique</TabsTrigger>
        </TabsList>
        <TabsContent value="trending" className="mt-6">
          <PaginatedCatalog queryOptions={moviePageQO("trending")} loadingLabel="Chargement des films…" />
        </TabsContent>
        <TabsContent value="popular" className="mt-6">
          <PaginatedCatalog queryOptions={moviePageQO("popular")} loadingLabel="Chargement des films…" />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-6">
          <PaginatedCatalog queryOptions={moviePageQO("upcoming")} loadingLabel="Chargement des films…" />
        </TabsContent>
        <TabsContent value="animated" className="mt-6">
          <PaginatedCatalog
            queryOptions={moviePageQO("animated")}
            loadingLabel="Chargement des films…"
            emptyLabel="Films d'animation indisponibles pour le moment."
          />
        </TabsContent>
        <TabsContent value="asian" className="mt-6">
          <PaginatedCatalog
            queryOptions={moviePageQO("asian")}
            loadingLabel="Chargement des films…"
            emptyLabel="Animation asiatique indisponible pour le moment."
          />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
