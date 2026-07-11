import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { ForYouRails } from "@/components/media/ForYouRails";
import { MediaCarousel } from "@/components/media/MediaCarousel";
import { RecommendationAssistant } from "@/components/media/RecommendationAssistant";
import { Sparkles } from "lucide-react";
import {
  trendingAnimeQO,
  popularAnimeQO,
  upcomingAnimeQO,
  seasonalAnimeQO,
  trendingMoviesQO,
  popularMoviesQO,
  upcomingMoviesQO,
  animatedMoviesQO,
  trendingSeriesQO,
  popularSeriesQO,
  onAirSeriesQO,
} from "@/lib/queries";

export const Route = createFileRoute("/pour-vous")({
  head: () => ({
    meta: [
      { title: "Pour vous — recommandations personnalisées | KAZEN" },
      {
        name: "description",
        content:
          "Des recommandations d'anime, séries et films qui s'adaptent à vos goûts, tout en gardant les tendances, nouveautés et titres populaires bien en vue.",
      },
    ],
  }),
  loader: async ({ context }) => {
    // Prime the shared discovery pool the recommendation engine reuses.
    await context.queryClient.ensureQueryData(trendingAnimeQO);
    void context.queryClient.prefetchQuery(popularAnimeQO);
    void context.queryClient.prefetchQuery(upcomingAnimeQO);
    void context.queryClient.prefetchQuery(seasonalAnimeQO());
    void context.queryClient.prefetchQuery(trendingMoviesQO);
    void context.queryClient.prefetchQuery(popularMoviesQO);
    void context.queryClient.prefetchQuery(upcomingMoviesQO);
    void context.queryClient.prefetchQuery(animatedMoviesQO);
    void context.queryClient.prefetchQuery(trendingSeriesQO);
    void context.queryClient.prefetchQuery(popularSeriesQO);
    void context.queryClient.prefetchQuery(onAirSeriesQO);
  },
  component: ForYouPage,
  errorComponent: ({ error }) => (
    <AppShell>
      <p role="alert" className="text-sm text-muted-foreground">
        {error.message}
      </p>
    </AppShell>
  ),
});

function ForYouPage() {
  const trendingAnime = useSuspenseQuery(trendingAnimeQO);
  const popularMovies = useSuspenseQuery(popularMoviesQO);
  const upcomingAnime = useSuspenseQuery(upcomingAnimeQO);
  const trendingSeries = useSuspenseQuery(trendingSeriesQO);

  return (
    <AppShell>
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              <Sparkles className="h-7 w-7 text-primary" />
              Pour vous
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Des suggestions qui s'affinent avec vos goûts, sans jamais perdre de vue les tendances,
              nouveautés et titres populaires du moment.
            </p>
          </div>
          <RecommendationAssistant />
        </div>
      </header>

      <ForYouRails />

      {/* Discovery stays strongly present, whatever the personalization level. */}
      <div className="mt-14 space-y-12 border-t border-border pt-12">
        <MediaCarousel
          title="Tendances du moment"
          subtitle="Ce que la communauté regarde en ce moment"
          action={{ label: "Anime", to: "/anime" }}
          items={trendingAnime.data}
          hideWhenEmpty
        />
        <MediaCarousel
          title="Nouveautés à venir"
          subtitle="Les sorties les plus attendues"
          action={{ label: "À venir", to: "/a-venir" }}
          items={upcomingAnime.data}
          hideWhenEmpty
        />
        <MediaCarousel
          title="Séries populaires"
          action={{ label: "Séries", to: "/series" }}
          items={trendingSeries.data}
          hideWhenEmpty
        />
        <MediaCarousel
          title="Films populaires"
          action={{ label: "Films", to: "/films" }}
          items={popularMovies.data}
          hideWhenEmpty
        />
      </div>
    </AppShell>
  );
}
