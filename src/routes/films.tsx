import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { CatalogGrid } from "@/components/media/CatalogGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  trendingMoviesQO,
  popularMoviesQO,
  upcomingMoviesQO,
  animatedMoviesQO,
  asianAnimationMoviesQO,
} from "@/lib/queries";

export const Route = createFileRoute("/films")({
  head: () => ({
    meta: [
      { title: "Films — KAZEN" },
      { name: "description", content: "Films tendance, populaires, à venir et films d'animation, avec leurs plateformes de disponibilité." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(trendingMoviesQO);
    context.queryClient.prefetchQuery(popularMoviesQO);
    context.queryClient.prefetchQuery(upcomingMoviesQO);
    context.queryClient.prefetchQuery(animatedMoviesQO);
    context.queryClient.prefetchQuery(asianAnimationMoviesQO);
  },
  component: MoviesPage,
});

function MoviesPage() {
  const trending = useSuspenseQuery(trendingMoviesQO);
  const popular = useSuspenseQuery(popularMoviesQO);
  const upcoming = useSuspenseQuery(upcomingMoviesQO);
  const animated = useSuspenseQuery(animatedMoviesQO);
  const asianAnimation = useSuspenseQuery(asianAnimationMoviesQO);

  return (
    <AppShell>
      <PageHeader title="Films" description="Du blockbuster au film culte, sans oublier l'animation." />
      <Tabs defaultValue="trending">
        <TabsList>
          <TabsTrigger value="trending">Tendance</TabsTrigger>
          <TabsTrigger value="popular">Populaires</TabsTrigger>
          <TabsTrigger value="upcoming">À venir</TabsTrigger>
          <TabsTrigger value="animated">Animation</TabsTrigger>
          <TabsTrigger value="asian">Animation asiatique</TabsTrigger>
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
        <TabsContent value="animated" className="mt-6">
          <CatalogGrid items={animated.data} />
        </TabsContent>
        <TabsContent value="asian" className="mt-6">
          <CatalogGrid items={asianAnimation.data} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
