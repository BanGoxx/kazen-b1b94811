import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Sparkles, Tv, Film, CalendarClock, Leaf } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DiscoverHero } from "@/components/media/DiscoverHero";
import { MediaCarousel } from "@/components/media/MediaCarousel";
import { QuickSearch } from "@/components/media/QuickSearch";
import { PlatformHighlights } from "@/components/media/PlatformHighlights";
import { MemberCTA } from "@/components/media/MemberCTA";
import { ForYouHomeBlock } from "@/components/media/ForYouHomeBlock";
import {
  trendingAnimeQO,
  trendingSeriesQO,
  trendingMoviesQO,
  upcomingAnimeQO,
  upcomingMoviesQO,
  popularSeriesQO,
  seasonalAnimeQO,
} from "@/lib/queries";

const QUICK_NAV = [
  { to: "/anime", label: "Anime", icon: Sparkles },
  { to: "/series", label: "Séries", icon: Tv },
  { to: "/films", label: "Films", icon: Film },
  { to: "/anime/saison", label: "Saison", icon: Leaf },
  { to: "/a-venir", label: "À venir", icon: CalendarClock },
] as const;

export const Route = createFileRoute("/")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://kazen.lovable.app/" }],
    meta: [{ property: "og:url", content: "https://kazen.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "KAZEN",
          url: "https://kazen.lovable.app/",
          description:
            "Le hub premium en français : tendances anime, séries et films, sorties à venir et plateformes de streaming réunis en un seul endroit.",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://kazen.lovable.app/recherche?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
          publisher: {
            "@type": "Organization",
            name: "KAZEN",
            url: "https://kazen.lovable.app/",
          },
        }),
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(trendingAnimeQO);
    await context.queryClient.ensureQueryData(upcomingAnimeQO);
    await context.queryClient.ensureQueryData(seasonalAnimeQO());
    void context.queryClient.prefetchQuery(trendingSeriesQO);
    void context.queryClient.prefetchQuery(trendingMoviesQO);
    void context.queryClient.prefetchQuery(upcomingMoviesQO);
    void context.queryClient.prefetchQuery(popularSeriesQO);
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
  const seasonal = useSuspenseQuery(seasonalAnimeQO());

  const hero = anime[0] ?? series.data[0] ?? movies.data[0];

  return (
    <AppShell>
      {hero ? (
        <div className="relative">
          <DiscoverHero item={hero} />
          <div className="-mt-8 mb-10 flex flex-col items-start gap-5 px-1 sm:-mt-10">
            <QuickSearch />
            <nav aria-label="Accès rapides" className="flex flex-wrap gap-2">
              {QUICK_NAV.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="focus-ring hover-lift inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-semibold text-foreground backdrop-blur hover:border-primary/40"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : (
        <div className="mb-10">
          <QuickSearch />
        </div>
      )}

      <div className="space-y-14">
        <ForYouHomeBlock />
        <MediaCarousel
          title="Tendances du moment"
          subtitle="Ce que la communauté regarde en ce moment"
          action={{ label: "Tout voir", to: "/anime" }}
          items={anime.slice(1)}
        />
        <MediaCarousel
          title="Anime à venir"
          subtitle="Les sorties les plus attendues"
          action={{ label: "À venir", to: "/a-venir" }}
          items={upAnime.data}
        />
        <MemberCTA />
        <MediaCarousel
          title="Séries en vedette"
          subtitle="Les incontournables du petit écran"
          action={{ label: "Tout voir", to: "/series" }}
          items={popSeries.data.length ? popSeries.data : series.data}
          hideWhenEmpty
        />
        <MediaCarousel
          title="Films à venir"
          subtitle="Prochainement en salle et en streaming"
          action={{ label: "À venir", to: "/a-venir" }}
          items={upMovies.data}
          hideWhenEmpty
        />
        <MediaCarousel
          title={`Saison anime · ${seasonal.data.label} ${seasonal.data.year}`}
          subtitle="La sélection de la saison en cours"
          action={{ label: "Voir la saison", to: "/anime/saison" }}
          items={seasonal.data.items}
        />
        <MediaCarousel
          title="Films tendance"
          subtitle="Les longs-métrages qui font parler d'eux"
          action={{ label: "Tout voir", to: "/films" }}
          items={movies.data}
          hideWhenEmpty
        />
        <PlatformHighlights />
      </div>
    </AppShell>
  );
}
