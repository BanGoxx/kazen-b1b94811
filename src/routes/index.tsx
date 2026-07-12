import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Sparkles, Tv, Film, CalendarClock, Leaf } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RotatingHero } from "@/components/media/RotatingHero";
import { MediaCarousel } from "@/components/media/MediaCarousel";
import { QuickSearch } from "@/components/media/QuickSearch";
import { PlatformHighlights } from "@/components/media/PlatformHighlights";
import { MemberCTA } from "@/components/media/MemberCTA";
import { ForYouHomeBlock } from "@/components/media/ForYouHomeBlock";
import { CategoryBand } from "@/components/media/CategoryBand";
import { SafeSection } from "@/components/media/SafeSection";
import type { MediaItem } from "@/lib/media-types";
import {
  trendingAnimeQO,
  popularAnimeQO,
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
    // Warm caches without blocking render: a transient upstream failure must
    // never turn the whole homepage into a 500 / crash screen. Each section
    // below is wrapped in its own error boundary and refetches with retry.
    void context.queryClient.prefetchQuery(trendingAnimeQO);
    void context.queryClient.prefetchQuery(popularAnimeQO);
    void context.queryClient.prefetchQuery(upcomingAnimeQO);
    void context.queryClient.prefetchQuery(seasonalAnimeQO());
    void context.queryClient.prefetchQuery(trendingSeriesQO);
    void context.queryClient.prefetchQuery(trendingMoviesQO);
    void context.queryClient.prefetchQuery(upcomingMoviesQO);
    void context.queryClient.prefetchQuery(popularSeriesQO);
  },
  component: DiscoverPage,
});

function HomeHero() {
  const { data: anime } = useSuspenseQuery(trendingAnimeQO);
  const { data: seasonal } = useSuspenseQuery(seasonalAnimeQO());
  const { data: series } = useSuspenseQuery(trendingSeriesQO);
  const { data: movies } = useSuspenseQuery(trendingMoviesQO);
  // Anime-first, with one strong series + film for variety. Max 5 slides.
  const withArt = (it: MediaItem | undefined) => !!it && !!(it.backdropUrl || it.posterUrl);
  const slides = [
    ...anime.slice(0, 3),
    ...seasonal.items.slice(0, 1),
    ...series.slice(0, 1),
    ...movies.slice(0, 1),
  ].filter(withArt);
  if (!slides.length) return null;
  return <RotatingHero items={slides} />;
}

function TrendingAnimeRow() {
  const { data } = useSuspenseQuery(trendingAnimeQO);
  return (
    <MediaCarousel
      title="Tendances anime"
      subtitle="Les anime que la communauté regarde en ce moment"
      action={{ label: "Tout voir", to: "/anime" }}
      items={data.slice(1)}
      hideWhenEmpty
    />
  );
}

function PopularAnimeRow() {
  const { data } = useSuspenseQuery(popularAnimeQO);
  return (
    <MediaCarousel
      title="Anime populaires"
      subtitle="Les valeurs sûres de l'animation"
      action={{ label: "Tout voir", to: "/anime" }}
      items={data}
      hideWhenEmpty
    />
  );
}

function UpcomingAnimeRow() {
  const { data } = useSuspenseQuery(upcomingAnimeQO);
  return (
    <MediaCarousel
      title="Anime à venir"
      subtitle="Les sorties les plus attendues"
      action={{ label: "À venir", to: "/a-venir" }}
      items={data}
      hideWhenEmpty
    />
  );
}

function SeasonalAnimeRow() {
  const { data } = useSuspenseQuery(seasonalAnimeQO());
  return (
    <MediaCarousel
      title={`Saison anime · ${data.label} ${data.year}`}
      subtitle="La sélection de la saison en cours"
      action={{ label: "Voir la saison", to: "/anime/saison" }}
      items={data.items}
      hideWhenEmpty
    />
  );
}

function FeaturedSeriesRow() {
  const popSeries = useSuspenseQuery(popularSeriesQO);
  const series = useSuspenseQuery(trendingSeriesQO);
  const items = popSeries.data.length ? popSeries.data : series.data;
  return (
    <MediaCarousel
      title="Séries en vedette"
      subtitle="Les incontournables du petit écran"
      action={{ label: "Tout voir", to: "/series" }}
      items={items}
      hideWhenEmpty
    />
  );
}

function UpcomingMoviesRow() {
  const { data } = useSuspenseQuery(upcomingMoviesQO);
  return (
    <MediaCarousel
      title="Films à venir"
      subtitle="Prochainement en salle et en streaming"
      action={{ label: "À venir", to: "/a-venir" }}
      items={data}
      hideWhenEmpty
    />
  );
}

function TrendingMoviesRow() {
  const { data } = useSuspenseQuery(trendingMoviesQO);
  return (
    <MediaCarousel
      title="Films tendance"
      subtitle="Les longs-métrages qui font parler d'eux"
      action={{ label: "Tout voir", to: "/films" }}
      items={data}
      hideWhenEmpty
    />
  );
}

function DiscoverPage() {
  return (
    <AppShell>
      <h1 className="sr-only">KAZEN — Votre hub anime, séries et films en français</h1>

      <div className="relative">
        <SafeSection minHeight="16rem">
          <HomeHero />
        </SafeSection>
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

      <div className="space-y-14">
        <SafeSection>
          <ForYouHomeBlock />
        </SafeSection>

        {/* ----- Univers anime (priorité KAZEN) ----- */}
        <CategoryBand
          icon={Sparkles}
          label="Univers anime"
          description="Tendances, valeurs sûres et sorties attendues de l'animation"
        />
        <SafeSection>
          <TrendingAnimeRow />
        </SafeSection>
        <SafeSection>
          <PopularAnimeRow />
        </SafeSection>
        <SafeSection>
          <UpcomingAnimeRow />
        </SafeSection>
        <SafeSection>
          <SeasonalAnimeRow />
        </SafeSection>

        <MemberCTA />

        {/* ----- Côté séries ----- */}
        <CategoryBand
          icon={Tv}
          label="Côté séries"
          description="Les incontournables et nouveautés du petit écran"
        />
        <SafeSection>
          <FeaturedSeriesRow />
        </SafeSection>

        {/* ----- Grand écran ----- */}
        <CategoryBand
          icon={Film}
          label="Grand écran"
          description="Films tendance et prochaines sorties ciné & streaming"
        />
        <SafeSection>
          <UpcomingMoviesRow />
        </SafeSection>
        <SafeSection>
          <TrendingMoviesRow />
        </SafeSection>

        <PlatformHighlights />
      </div>

    </AppShell>
  );
}

