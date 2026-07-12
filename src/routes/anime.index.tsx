import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { PaginatedCatalog } from "@/components/media/PaginatedCatalog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { animePageQO } from "@/lib/queries";

const TABS = new Set(["trending", "popular", "upcoming"]);

export const Route = createFileRoute("/anime/")({
  // Keep the active tab in the URL so browser back/forward and refresh restore
  // it (and each tab gets its own scroll-restoration entry).
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" && TABS.has(search.tab) ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Anime — KAZEN" },
      { name: "description", content: "Découvrez les anime tendance, populaires et à venir, avec leurs plateformes de diffusion." },
      { property: "og:title", content: "Anime — KAZEN" },
      { property: "og:description", content: "Découvrez les anime tendance, populaires et à venir, avec leurs plateformes de diffusion." },
      { property: "og:url", content: "https://kazen.lovable.app/anime" },
    ],
    links: [{ rel: "canonical", href: "https://kazen.lovable.app/anime" }],
  }),
  loader: ({ context }) => {
    // Warm all anime tabs without blocking: the catalog has its own error/pending
    // boundary, so an upstream hiccup degrades locally instead of failing SSR.
    void context.queryClient.ensureInfiniteQueryData(animePageQO("trending"));
    void context.queryClient.prefetchInfiniteQuery(animePageQO("popular"));
    void context.queryClient.prefetchInfiniteQuery(animePageQO("upcoming"));
  },
  component: AnimePage,
});

function AnimePage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <AppShell>
      <PageHeader title="Anime" description="Le meilleur de l'animation, tendance et à venir." />
      <Tabs
        value={tab ?? "trending"}
        onValueChange={(value) =>
          navigate({ to: "/anime", search: { tab: value }, replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value="trending">Tendance</TabsTrigger>
          <TabsTrigger value="popular">Populaires</TabsTrigger>
          <TabsTrigger value="upcoming">À venir</TabsTrigger>
        </TabsList>
        <TabsContent value="trending" className="mt-6">
          <PaginatedCatalog queryOptions={animePageQO("trending")} upgradeOnMount />
        </TabsContent>
        <TabsContent value="popular" className="mt-6">
          <PaginatedCatalog queryOptions={animePageQO("popular")} upgradeOnMount />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-6">
          <PaginatedCatalog
            queryOptions={animePageQO("upcoming")}
            upgradeOnMount
            emptyLabel="Aucun anime à venir listé pour le moment."
          />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
