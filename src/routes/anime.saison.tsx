import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { PaginatedCatalog } from "@/components/media/PaginatedCatalog";
import { seasonalAnimePageQO } from "@/lib/queries";

const SEASON_LABELS: Record<string, string> = {
  WINTER: "Hiver",
  SPRING: "Printemps",
  SUMMER: "Été",
  FALL: "Automne",
};

function currentSeasonLabel(): string {
  const now = new Date();
  const m = now.getMonth();
  const season = m < 3 ? "WINTER" : m < 6 ? "SPRING" : m < 9 ? "SUMMER" : "FALL";
  return `${SEASON_LABELS[season]} ${now.getFullYear()}`;
}

export const Route = createFileRoute("/anime/saison")({
  head: () => ({
    meta: [
      { title: "Anime de la saison — KAZEN" },
      { name: "description", content: "Tous les anime de la saison en cours, classés par popularité." },
      { property: "og:title", content: "Anime de la saison — KAZEN" },
      { property: "og:description", content: "Tous les anime de la saison en cours, classés par popularité." },
      { property: "og:url", content: "https://kazen.lovable.app/anime/saison" },
    ],
    links: [{ rel: "canonical", href: "https://kazen.lovable.app/anime/saison" }],
  }),
  loader: async ({ context }) => {
    void context.queryClient.ensureInfiniteQueryData(seasonalAnimePageQO());
  },
  component: SeasonPage,
});

function SeasonPage() {
  return (
    <AppShell>
      <PageHeader
        title={`Saison anime — ${currentSeasonLabel()}`}
        description="Les sorties anime de la saison en cours."
      />
      <PaginatedCatalog
        queryOptions={seasonalAnimePageQO()}
        upgradeOnMount
        emptyLabel="Aucun anime pour cette saison."
        completionLabel="Saison complète — tous les anime de la saison sont affichés"
      />
      <p className="mt-6 text-center text-xs text-muted-foreground">
        La liste couvre l'intégralité de la saison en cours (source AniList).
        Les nouveaux titres annoncés apparaissent automatiquement.
      </p>
    </AppShell>
  );
}
