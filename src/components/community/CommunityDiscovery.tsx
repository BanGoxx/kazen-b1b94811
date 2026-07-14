import { Link } from "@tanstack/react-router";
import { Flame, MessageSquareQuote, Sparkles, Star } from "lucide-react";
import { SafeImage } from "@/components/media/SafeImage";
import {
  useTrendingTitles,
  useHelpfulReviews,
  useGenreTrends,
  type TrendingTitle,
} from "@/lib/community";

/**
 * Community discovery module for the home page.
 *
 * Surfaces three privacy-safe, aggregate signals — trending titles, useful
 * member reviews and genre momentum — each backed by a threshold-gated
 * SECURITY DEFINER RPC. Every block renders only when there is enough real
 * community activity, so a young/quiet community never shows noise or fake
 * data. The whole module hides when nothing qualifies.
 */
export function CommunityDiscovery() {
  const { data: titles = [], isLoading: loadingTitles } = useTrendingTitles(12);
  const { data: reviews = [], isLoading: loadingReviews } = useHelpfulReviews(6);
  const { data: genres = [], isLoading: loadingGenres } = useGenreTrends(10);

  const hasTitles = titles.length > 0;
  const hasReviews = reviews.length > 0;
  const hasGenres = genres.length > 0;

  // Nothing qualifies yet — stay invisible so discovery content stays dominant.
  if (
    !loadingTitles &&
    !loadingReviews &&
    !loadingGenres &&
    !hasTitles &&
    !hasReviews &&
    !hasGenres
  ) {
    return null;
  }
  if (!hasTitles && !hasReviews && !hasGenres) return null;

  return (
    <section aria-labelledby="community-discovery-heading" className="space-y-8">
      <div className="space-y-1">
        <h2
          id="community-discovery-heading"
          className="flex items-center gap-2 text-lg font-bold text-foreground"
        >
          <Flame className="h-5 w-5 text-primary" /> La communauté KAZEN
        </h2>
        <p className="text-sm text-muted-foreground">
          Ce que les membres ajoutent, notent et recommandent en ce moment.
        </p>
      </div>

      {hasTitles && <TrendingTitles titles={titles} />}
      {hasGenres && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> Genres qui montent
          </span>
          {genres.map((g) => (
            <span
              key={g.genre}
              className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-foreground backdrop-blur"
            >
              {g.genre}
              <span className="ml-1.5 text-primary">{g.member_count}</span>
            </span>
          ))}
        </div>
      )}
      {hasReviews && <HelpfulReviews reviews={reviews} />}
    </section>
  );
}

function TrendingTitles({ titles }: { titles: TrendingTitle[] }) {
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Flame className="h-4 w-4 text-primary" /> Titres les plus ajoutés
      </h3>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {titles.map((t) => (
          <Link
            key={t.media_key}
            to="/media/$source/$id"
            params={{ source: t.source, id: t.external_id }}
            className="group flex flex-col gap-2"
          >
            <div className="relative overflow-hidden rounded-xl ring-1 ring-border">
              {t.poster_url ? (
                <SafeImage
                  src={t.poster_url}
                  alt={t.title}
                  className="aspect-[2/3] w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex aspect-[2/3] w-full items-center justify-center bg-muted/40">
                  <Flame className="h-5 w-5 text-muted-foreground/60" />
                </div>
              )}
              <span className="absolute left-1.5 top-1.5 rounded-full bg-background/85 px-2 py-0.5 text-[0.65rem] font-semibold text-primary backdrop-blur">
                {t.member_count} ajouts
              </span>
            </div>
            <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground group-hover:text-primary">
              {t.title}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function HelpfulReviews({ reviews }: { reviews: import("@/lib/community").HelpfulReview[] }) {
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageSquareQuote className="h-4 w-4 text-primary" /> Avis utiles
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r) => (
          <Link
            key={r.id}
            to="/media/$source/$id"
            params={{ source: r.media_source, id: r.media_external_id }}
            className="group flex flex-col gap-2 rounded-2xl border border-border bg-card/50 p-4 backdrop-blur transition-colors hover:border-primary/50 hover:bg-card/70"
          >
            <div className="flex items-center gap-2">
              {r.media_poster_url && (
                <SafeImage
                  src={r.media_poster_url}
                  alt=""
                  className="h-10 w-8 shrink-0 rounded object-cover ring-1 ring-border"
                />
              )}
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-semibold text-foreground group-hover:text-primary">
                  {r.media_title ?? "Titre KAZEN"}
                </p>
                {r.rating != null && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-primary">
                    <Star className="h-3 w-3 fill-current" /> {r.rating}/10
                  </span>
                )}
              </div>
            </div>
            <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{r.body}</p>
            <div className="mt-auto flex items-center justify-between text-[0.7rem] text-muted-foreground">
              <span className="truncate">{r.author_display_name}</span>
              <span className="text-primary">{r.helpful_votes} utile{r.helpful_votes > 1 ? "s" : ""}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
