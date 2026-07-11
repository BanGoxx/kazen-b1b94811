import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/media/SectionHeader";
import { MediaGrid } from "@/components/media/MediaGrid";
import { upcomingAllQO } from "@/lib/queries";

export const Route = createFileRoute("/a-venir")({
  head: () => ({
    meta: [
      { title: "À venir — NEXUS MEDIA" },
      { name: "description", content: "Toutes les prochaines sorties anime et films, classées par date de sortie." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(upcomingAllQO);
  },
  component: UpcomingPage,
});

function UpcomingPage() {
  const { data } = useSuspenseQuery(upcomingAllQO);
  return (
    <AppShell>
      <PageHeader
        title="Sorties à venir"
        description="Anime et films attendus, du plus proche au plus lointain."
      />
      <MediaGrid items={data} emptyLabel="Aucune sortie annoncée pour le moment." />
    </AppShell>
  );
}
