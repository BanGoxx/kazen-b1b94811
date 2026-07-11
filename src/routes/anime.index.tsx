import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { PaginatedCatalog } from "@/components/media/PaginatedCatalog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { animePageQO } from "@/lib/queries";

export const Route = createFileRoute("/anime/")({
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
  loader: async ({ context }) => {
    await context.queryClient.ensureInfiniteQueryData(animePageQO("trending"));
  },
  component: AnimePage,
});

function AnimePage() {
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
          <PaginatedCatalog queryOptions={animePageQO("trending")} />
        </TabsContent>
        <TabsContent value="popular" className="mt-6">
          <PaginatedCatalog queryOptions={animePageQO("popular")} />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-6">
          <PaginatedCatalog
            queryOptions={animePageQO("upcoming")}
            emptyLabel="Aucun anime à venir listé pour le moment."
          />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
