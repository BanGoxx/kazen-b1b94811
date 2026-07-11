import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { MediaGrid } from "@/components/media/MediaGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trendingSeriesQO, popularSeriesQO, onAirSeriesQO } from "@/lib/queries";

export const Route = createFileRoute("/series")({
  head: () => ({
    meta: [
      { title: "Séries — NEXUS MEDIA" },
      { name: "description", content: "Séries tendance, populaires et en cours de diffusion, avec plateformes de streaming." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(trendingSeriesQO);
    context.queryClient.prefetchQuery(popularSeriesQO);
    context.queryClient.prefetchQuery(onAirSeriesQO);
  },
  component: SeriesPage,
});

function SeriesPage() {
  const trending = useSuspenseQuery(trendingSeriesQO);
  const popular = useSuspenseQuery(popularSeriesQO);
  const onair = useSuspenseQuery(onAirSeriesQO);

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
          <MediaGrid items={trending.data} />
        </TabsContent>
        <TabsContent value="popular" className="mt-6">
          <MediaGrid items={popular.data} />
        </TabsContent>
        <TabsContent value="onair" className="mt-6">
          <MediaGrid items={onair.data} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
