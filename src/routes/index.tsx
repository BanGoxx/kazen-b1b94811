import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { DiscoverHero } from "@/components/media/DiscoverHero";
import { MediaCarousel } from "@/components/media/MediaCarousel";
import {
  trendingAnimeQO,
  trendingSeriesQO,
  trendingMoviesQO,
  upcomingAnimeQO,
  upcomingMoviesQO,
  popularSeriesQO,
} from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NEXUS MEDIA — Découvrez anime, séries et films" },
      { name: "description", content: "Le hub premium en français : tendances anime, séries et films, sorties à venir et plateformes de streaming réunis en un seul endroit." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(trendingAnimeQO);
    context.queryClient.prefetchQuery(trendingSeriesQO);
    context.queryClient.prefetchQuery(trendingMoviesQO);
    context.queryClient.prefetchQuery(upcomingAnimeQO);
    context.queryClient.prefetchQuery(upcomingMoviesQO);
    context.queryClient.prefetchQuery(popularSeriesQO);
  },
  component: DiscoverPage,
});

function DiscoverPage() {
  const { data: anime } = useSuspenseQuery(trendingAnimeQO);
  const series = useSuspenseQuery(trendingSeriesQO);
  const movies = useSuspenseQuery(trendingMoviesQO);
  const upAnime = useSuspenseQuery(upcomingAnimeQO);
  const upMovies = useSuspenseQuery(upcomingMoviesQO);
  const popSeries = useSuspenseQuery(popularSeriesQO);

  const hero = anime[0] ?? series.data[0] ?? movies.data[0];

  return (
    <AppShell>
      {hero ? <DiscoverHero item={hero} /> : null}
      <div className="space-y-12">
        <MediaCarousel
          title="Anime tendance"
          subtitle="Ce que la communauté regarde en ce moment"
          action={{ label: "Tout voir", to: "/anime" }}
          items={anime.slice(1)}
        />
        <MediaCarousel
          title="Séries tendance"
          action={{ label: "Tout voir", to: "/series" }}
          items={series.data}
        />
        <MediaCarousel
          title="Films tendance"
          action={{ label: "Tout voir", to: "/films" }}
          items={movies.data}
        />
        <MediaCarousel
          title="Prochaines sorties anime"
          action={{ label: "À venir", to: "/a-venir" }}
          items={upAnime.data}
        />
        <MediaCarousel
          title="Films à venir"
          action={{ label: "À venir", to: "/a-venir" }}
          items={upMovies.data}
        />
        <MediaCarousel
          title="Séries populaires"
          action={{ label: "Tout voir", to: "/series" }}
          items={popSeries.data}
        />
      </div>
    </AppShell>
  );
}
