import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { PaginatedCatalog } from "@/components/media/PaginatedCatalog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { seriesPageQO } from "@/lib/queries";

export const Route = createFileRoute("/series")({
  head: () => ({
    meta: [
      { title: "Séries — KAZEN" },
      { name: "description", content: "Séries tendance, populaires et en cours de diffusion, avec plateformes de streaming." },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureInfiniteQueryData(seriesPageQO("trending"));
  },
  component: SeriesPage,
});

function SeriesPage() {
  return (
    <AppShell>
      <PageHeader title="Séries" description="Les séries à ne pas manquer, d'ici et d'ailleurs." />
      <Tabs defaultValue="trending">
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
