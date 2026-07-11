import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { MediaGrid } from "@/components/media/MediaGrid";
import { seasonalAnimeQO } from "@/lib/queries";

export const Route = createFileRoute("/anime/saison")({
  head: () => ({
    meta: [
      { title: "Anime de la saison — KAZEN" },
      { name: "description", content: "Tous les anime de la saison en cours, classés par popularité." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(seasonalAnimeQO());
  },
  component: SeasonPage,
});

function SeasonPage() {
  const { data } = useSuspenseQuery(seasonalAnimeQO());
  return (
    <AppShell>
      <PageHeader
        title={`Saison anime — ${data.label} ${data.year}`}
        description="Les sorties anime de la saison en cours."
      />
      <MediaGrid items={data.items} emptyLabel="Aucun anime pour cette saison." />
    </AppShell>
  );
}
