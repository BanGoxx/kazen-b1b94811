import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { MediaGrid } from "@/components/media/MediaGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trendingAnimeQO, popularAnimeQO, upcomingAnimeQO } from "@/lib/queries";

export const Route = createFileRoute("/anime/")({
  head: () => ({
    meta: [
      { title: "Anime — NEXUS MEDIA" },
      { name: "description", content: "Découvrez les anime tendance, populaires et à venir, avec leurs plateformes de diffusion." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(trendingAnimeQO);
    context.queryClient.prefetchQuery(popularAnimeQO);
    context.queryClient.prefetchQuery(upcomingAnimeQO);
  },
  component: AnimePage,
});

function AnimePage() {
  const trending = useSuspenseQuery(trendingAnimeQO);
  const popular = useSuspenseQuery(popularAnimeQO);
  const upcoming = useSuspenseQuery(upcomingAnimeQO);

  return (
    <AppShell>
      <PageHeader title="Anime" description="Le meilleur de l'animation, tendance et à venir." />
      <Tabs defaultValue="trending">
        <TabsList>
          <TabsTrigger value="trending">Tendance</TabsTrigger>
          <TabsTrigger value="popular">Populaires</TabsTrigger>
          <TabsTrigger value="upcoming">À venir</TabsTrigger>
        </TabsList>
        <TabsContent value="trending" className="mt-6">
          <MediaGrid items={trending.data} />
        </TabsContent>
        <TabsContent value="popular" className="mt-6">
          <MediaGrid items={popular.data} />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-6">
          <MediaGrid items={upcoming.data} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
