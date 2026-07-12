import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { PaginatedCatalog } from "@/components/media/PaginatedCatalog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { seriesPageQO } from "@/lib/queries";

const SERIES_TABS = new Set(["trending", "popular", "onair"]);

export const Route = createFileRoute("/series")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" && SERIES_TABS.has(search.tab) ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Séries — KAZEN" },
      { name: "description", content: "Séries tendance, populaires et en cours de diffusion, avec plateformes de streaming." },
      { property: "og:title", content: "Séries — KAZEN" },
      { property: "og:description", content: "Séries tendance, populaires et en cours de diffusion, avec plateformes de streaming." },
      { property: "og:url", content: "https://kazen.lovable.app/series" },
    ],
    links: [{ rel: "canonical", href: "https://kazen.lovable.app/series" }],
  }),
  loader: async ({ context }) => {
    void context.queryClient.ensureInfiniteQueryData(seriesPageQO("trending"));
  },
  component: SeriesPage,
});

function SeriesPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <AppShell>
      <PageHeader title="Séries" description="Les séries à ne pas manquer, d'ici et d'ailleurs." />
      <Tabs
        value={tab ?? "trending"}
        onValueChange={(value) =>
          navigate({ to: "/series", search: { tab: value }, replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value="trending">Tendance</TabsTrigger>
          <TabsTrigger value="popular">Populaires</TabsTrigger>
          <TabsTrigger value="onair">En diffusion</TabsTrigger>
        </TabsList>
        <TabsContent value="trending" className="mt-6">
          <PaginatedCatalog queryOptions={seriesPageQO("trending")} />
        </TabsContent>
        <TabsContent value="popular" className="mt-6">
          <PaginatedCatalog queryOptions={seriesPageQO("popular")} />
        </TabsContent>
        <TabsContent value="onair" className="mt-6">
          <PaginatedCatalog queryOptions={seriesPageQO("onair")} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
