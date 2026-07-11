import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { CatalogGrid } from "@/components/media/CatalogGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trendingAnimeQO, popularAnimeQO, upcomingAnimeQO } from "@/lib/queries";

export const Route = createFileRoute("/anime/")({
  head: () => ({
    meta: [
      { title: "Anime — KAZEN" },
      { name: "description", content: "Découvrez les anime tendance, populaires et à venir, avec leurs plateformes de diffusion." },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(trendingAnimeQO);
    void context.queryClient.prefetchQuery(popularAnimeQO);
    void context.queryClient.prefetchQuery(upcomingAnimeQO);
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
          <CatalogGrid items={trending.data} />
        </TabsContent>
        <TabsContent value="popular" className="mt-6">
          <CatalogGrid items={popular.data} />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-6">
          <CatalogGrid items={upcoming.data} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
