import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { CatalogGrid } from "@/components/media/CatalogGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trendingMoviesQO, popularMoviesQO, upcomingMoviesQO } from "@/lib/queries";

export const Route = createFileRoute("/films")({
  head: () => ({
    meta: [
      { title: "Films — KAZEN" },
      { name: "description", content: "Films tendance, populaires et à venir, avec leurs plateformes de disponibilité." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(trendingMoviesQO);
    context.queryClient.prefetchQuery(popularMoviesQO);
    context.queryClient.prefetchQuery(upcomingMoviesQO);
  },
  component: MoviesPage,
});

function MoviesPage() {
  const trending = useSuspenseQuery(trendingMoviesQO);
  const popular = useSuspenseQuery(popularMoviesQO);
  const upcoming = useSuspenseQuery(upcomingMoviesQO);

  return (
    <AppShell>
      <PageHeader title="Films" description="Du blockbuster au film culte, tout est là." />
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
