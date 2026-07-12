import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Clapperboard,
  Clock,
  Film,
  Flame,
  Globe,
  Network,
  Info,
  Layers,
  ShieldCheck,
  Sparkles,
  Tv,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RatingBadge } from "@/components/media/RatingBadge";
import { SafeImage } from "@/components/media/SafeImage";
import { TrailerDialog } from "@/components/media/TrailerDialog";
import { CreditScroller } from "@/components/media/CreditScroller";
import { RelatedContent } from "@/components/media/RelatedContent";
import { UserListPanel } from "@/components/media/UserListPanel";
import { AddToPlaylist } from "@/components/media/AddToPlaylist";
import { FicheSection } from "@/components/media/FicheSection";
import { FicheReviews } from "@/components/media/FicheReviews";
import { FicheArticles } from "@/components/media/FicheArticles";
import { ExpandableText } from "@/components/media/ExpandableText";
import { VideoGallery } from "@/components/media/VideoGallery";
import { WhereToWatch } from "@/components/media/WhereToWatch";
import { NextEpisodeCard } from "@/components/media/NextEpisodeCard";
import { NextEpisodePill } from "@/components/media/NextEpisodePill";
import { EpisodeList } from "@/components/media/EpisodeList";
import { FicheTrackingBadge } from "@/components/media/FicheTrackingBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MEDIA_TYPE_LABELS, STATUS_LABELS } from "@/lib/media-types";
import { deriveGroupAnchor, hasFranchiseLinks } from "@/lib/franchise";
import { mediaDetailQO } from "@/lib/queries";
import { getRelevantArticlesForTitle, toFicheArticle } from "@/lib/news";
import { anilistPublicDetail } from "@/lib/anilist-public";

// PRESERVATION: KAZEN rich fiches (synopsis, épisodes, personnages & voix,
// équipe, source/relations, franchise/univers, vidéos, plateformes, article
// relevance, avis, actions liste) are validated core product behaviors.
// Do not remove, simplify, or hide these sections during visual polish.


export const Route = createFileRoute("/media/$source/$id")({
  loader: async ({ context, params }) => {
    const item = await context.queryClient.ensureQueryData(
      mediaDetailQO(params.source, params.id),
    );
    if (!item && params.source !== "anilist") throw notFound();
    return { item };
  },
  head: ({ loaderData, params }) => {
    const canonical = `https://kazen.lovable.app/media/${params.source}/${params.id}`;
    const item = loaderData?.item;
    if (!item) {
      return {
        meta: [
          { title: "Fiche introuvable — KAZEN" },
          { name: "description", content: "Ce contenu n'est pas disponible sur KAZEN." },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const kind = MEDIA_TYPE_LABELS[item.mediaType];
    const title = `${item.title} — ${kind} — KAZEN`;
    const rawSynopsis = item.synopsis?.trim();
    const description = rawSynopsis
      ? rawSynopsis.length > 155
        ? `${rawSynopsis.slice(0, 152).trimEnd()}…`
        : rawSynopsis
      : `Découvrez ${item.title} sur KAZEN : plateformes, casting, bande-annonce et suivi personnel.`;
    const image = item.backdropUrl || item.posterUrl;
    const schemaType = item.mediaType === "movie" ? "Movie" : "TVSeries";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "video.other" },
        { property: "og:url", content: canonical },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": schemaType,
            name: item.title,
            description,
            url: canonical,
            ...(item.posterUrl ? { image: item.posterUrl } : {}),
          }),
        },
      ],
    };
  },

  component: MediaDetailPage,
  pendingComponent: () => (
    <AppShell>
      <div className="-mx-4 -mt-8 h-64 sm:-mx-6 sm:h-80 lg:-mx-10 lg:h-[26rem]">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <div className="relative -mt-28 grid gap-8 sm:-mt-32 lg:grid-cols-[300px_1fr] lg:-mt-40">
        <div className="mx-auto w-44 sm:w-52 lg:mx-0 lg:w-full">
          <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-2/3 max-w-2xl" />
          <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Fiche introuvable</h1>
        <p className="mt-2 text-muted-foreground">Ce contenu n'est pas disponible.</p>
        <Button asChild className="mt-6">
          <Link to="/">Retour à la découverte</Link>
        </Button>
      </div>
    </AppShell>
  ),
});

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

function MediaDetailPage() {
  const { source, id } = Route.useParams();
  const router = useRouter();
  const { data: serverItem } = useSuspenseQuery(mediaDetailQO(source, id));
  const needsBrowserDetail =
    source === "anilist" &&
    (!serverItem || !serverItem.synopsis || !serverItem.cast.length || !serverItem.crew.length);
  const browserDetail = useQuery({
    queryKey: ["media", "anilist-public-detail", id],
    queryFn: () => anilistPublicDetail(Number(id)),
    enabled: needsBrowserDetail && typeof window !== "undefined" && Number.isFinite(Number(id)),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
  const item = source === "anilist" ? (browserDetail.data ?? serverItem) : serverItem;
  if (!item) {
    return (
      <AppShell>
        <div className="py-24 text-center">
          <h1 className="font-display text-2xl font-bold">
            {source === "anilist" && browserDetail.isPending ? "Chargement de la fiche…" : "Fiche introuvable"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {source === "anilist" && browserDetail.isPending
              ? "Récupération des données riches depuis AniList."
              : "Ce contenu n'est pas disponible."}
          </p>
          {source === "anilist" && browserDetail.isPending ? (
            <div className="mx-auto mt-6 h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          ) : (
            <Button asChild className="mt-6">
              <Link to="/">Retour à la découverte</Link>
            </Button>
          )}
        </div>
      </AppShell>
    );
  }

  const universeAnchor = deriveGroupAnchor(
    { source, externalId: id },
    item.related,
  );
  const titleArticles = getRelevantArticlesForTitle(source, id, {
    universeKey: `${universeAnchor.source}:${universeAnchor.externalId}`,
    relatedRefs: item.related.map((r) => ({
      source: r.source,
      externalId: r.externalId,
    })),
  }).map(({ article, relevance }) => toFicheArticle(article, relevance));


  const released = fmtDate(item.releaseDate);
  const facts: { icon: typeof CalendarDays; label: string; value: string }[] = [];
  if (item.format) facts.push({ icon: Clapperboard, label: "Format", value: item.format });
  if (item.status) facts.push({ icon: Tv, label: "Statut", value: STATUS_LABELS[item.status] });
  if (released) facts.push({ icon: CalendarDays, label: "Sortie", value: released });
  if (item.seasonLabel) facts.push({ icon: Sparkles, label: "Saison", value: item.seasonLabel });
  if (item.episodesCount) facts.push({ icon: Layers, label: "Épisodes", value: String(item.episodesCount) });
  if (item.seasonsCount) facts.push({ icon: Layers, label: "Saisons", value: String(item.seasonsCount) });
  if (item.runtime) facts.push({ icon: Clock, label: "Durée", value: `${item.runtime} min` });
  if (item.popularity) facts.push({ icon: Flame, label: "Popularité", value: item.popularity.toLocaleString("fr-FR") });

  const endReleased = fmtDate(item.endDate);
  const infos: { icon: typeof CalendarDays; label: string; value: string }[] = [];
  if (item.originSource) infos.push({ icon: Film, label: "Source", value: item.originSource });
  if (item.ageRating) infos.push({ icon: ShieldCheck, label: "Classification", value: item.ageRating });
  if (item.countryOfOrigin) infos.push({ icon: Globe, label: "Origine", value: item.countryOfOrigin });
  if (endReleased) infos.push({ icon: CalendarDays, label: "Fin de diffusion", value: endReleased });

  // At-a-glance strip: the few facts a user scans first, kept ultra-compact.
  const releaseYear = item.releaseDate ? item.releaseDate.slice(0, 4) : null;
  const heroStats: string[] = [];
  if (item.format) heroStats.push(item.format);
  if (releaseYear) heroStats.push(releaseYear);
  if (item.status) heroStats.push(STATUS_LABELS[item.status]);
  if (item.episodesCount) heroStats.push(`${item.episodesCount} ép.`);
  else if (item.seasonsCount) heroStats.push(`${item.seasonsCount} saison${item.seasonsCount > 1 ? "s" : ""}`);
  if (item.runtime) heroStats.push(`${item.runtime} min`);



  return (
    <AppShell>
      {/* Cinematic backdrop */}
      <div className="grain relative -mx-4 -mt-8 mb-0 h-64 overflow-hidden sm:-mx-6 sm:h-80 lg:-mx-10 lg:h-[26rem]">
        {item.backdropUrl ? (
          <SafeImage src={item.backdropUrl} alt="" variant="backdrop" fallbackLabel={item.title} loading="eager" fetchPriority="high" decoding="async" className="h-full w-full scale-105 object-cover" />
        ) : (
          <div className="h-full w-full aurora-bg opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 to-transparent" />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.history.back()}
          className="absolute left-4 top-4 border border-white/10 backdrop-blur transition-transform hover:scale-[1.03] sm:left-6"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Button>
      </div>

      <div className="relative -mt-28 grid gap-8 sm:-mt-32 lg:grid-cols-[300px_1fr] lg:-mt-40">
        {/* Left column: poster + platforms + user panel */}
        <div className="space-y-5">
          <div className="mx-auto w-44 sm:w-52 lg:mx-0 lg:w-full">
            <div className="poster-glow overflow-hidden rounded-2xl border border-border bg-card">
              {item.posterUrl ? (
                <SafeImage src={item.posterUrl} alt={item.title} variant="poster" fallbackLabel={item.title} loading="eager" decoding="async" width={300} height={450} className="aspect-[2/3] w-full object-cover" />
              ) : (
                <div className="aspect-[2/3] w-full aurora-bg opacity-40" />
              )}
            </div>
          </div>

          <NextEpisodeCard nextEpisode={item.nextEpisode} />

          <WhereToWatch platforms={item.platforms} />

          <UserListPanel item={item} />

          <AddToPlaylist item={item} />
        </div>

        {/* Right column: content */}
        <div className="min-w-0 space-y-8">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full aurora-bg px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                {MEDIA_TYPE_LABELS[item.mediaType]}
              </span>
              <RatingBadge score={item.score} />
              <NextEpisodePill nextEpisode={item.nextEpisode} className="text-xs" />
              {item.studios.length ? (
                <span className="text-sm text-muted-foreground">
                  {item.studios.slice(0, 2).join(" · ")}
                </span>
              ) : null}
            </div>
            <h1 className="text-balance font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-4xl lg:text-5xl">
              {item.title}
            </h1>
            {item.titleOriginal && item.titleOriginal !== item.title ? (
              <p className="text-lg text-muted-foreground">{item.titleOriginal}</p>
            ) : null}
            {heroStats.length ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                {heroStats.map((s, i) => (
                  <span key={s} className="flex items-center gap-2">
                    {i > 0 ? <span aria-hidden className="text-muted-foreground/40">·</span> : null}
                    <span className="font-medium text-foreground/90">{s}</span>
                  </span>
                ))}
              </div>
            ) : null}
            <FicheTrackingBadge mediaKey={item.key} />
            {hasFranchiseLinks(item.related)
              ? (() => {
                  const anchor = deriveGroupAnchor(
                    { source: item.source, externalId: item.externalId },
                    item.related,
                  );
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/univers/$source/$id"
                        params={{ source: anchor.source, id: anchor.externalId }}
                        search={{ type: "anime" }}
                        className="focus-ring inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                      >
                        <Network className="h-3.5 w-3.5" />
                        Voir l'univers de {item.title}
                      </Link>
                      <Link
                        to="/franchise/$source/$id"
                        params={{ source: anchor.source, id: anchor.externalId }}
                        className="focus-ring inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                      >
                        <Network className="h-3.5 w-3.5" />
                        Groupe complet
                      </Link>
                    </div>
                  );
                })()
              : null}
            {item.genres.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {item.genres.map((g) => (
                  <Link
                    key={g}
                    to="/recherche"
                    search={{ genres: g }}
                    className="focus-ring rounded-full"
                    aria-label={`Explorer le genre ${g}`}
                  >
                    <Badge
                      variant="secondary"
                      className="cursor-pointer transition-colors hover:bg-primary/20 hover:text-primary"
                    >
                      {g}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : null}
            {item.trailerUrl ? (
              <div className="pt-2">
                <TrailerDialog url={item.trailerUrl} title={item.title} />
              </div>
            ) : null}
          </div>

          {facts.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {facts.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.label} className="hover-lift rounded-xl border border-border bg-card/60 p-3 backdrop-blur transition-colors hover:border-primary/40">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5 text-primary" /> {f.label}
                    </div>
                    <p className="mt-1 font-semibold">{f.value}</p>
                  </div>
                );
              })}
            </div>
          ) : null}

          {item.synopsis ? (
            <FicheSection title="Synopsis" icon={<Sparkles className="h-5 w-5" />}>
              <ExpandableText text={item.synopsis} />
            </FicheSection>
          ) : null}

          {item.titleAlternatives.length ? (
            <FicheSection title="Titres alternatifs" icon={<Info className="h-5 w-5" />}>
              <div className="flex flex-wrap gap-2">
                {item.titleAlternatives.map((t) => (
                  <Badge key={t} variant="outline" className="font-normal">{t}</Badge>
                ))}
              </div>
            </FicheSection>
          ) : null}

          {infos.length ? (
            <FicheSection title="Informations" icon={<Info className="h-5 w-5" />}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {infos.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.label} className="hover-lift rounded-xl border border-border bg-card/60 p-3 backdrop-blur transition-colors hover:border-primary/40">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Icon className="h-3.5 w-3.5 text-primary" /> {f.label}
                      </div>
                      <p className="mt-1 font-semibold">{f.value}</p>
                    </div>
                  );
                })}
              </div>
            </FicheSection>
          ) : null}

          {item.videos.length ? (
            <FicheSection title="Bandes-annonces & vidéos" icon={<Clapperboard className="h-5 w-5" />}>
              <VideoGallery videos={item.videos} title={item.title} />
            </FicheSection>
          ) : null}

          {item.mediaType !== "movie" && item.episodes.length ? (
            <FicheSection title="Épisodes" icon={<Clapperboard className="h-5 w-5" />}>
              <EpisodeList episodes={item.episodes} />
            </FicheSection>
          ) : null}



          <CreditScroller title={item.castLabel} people={item.cast} kind="character" />
          <CreditScroller title={item.crewLabel} people={item.crew} kind="staff" />

          <RelatedContent related={item.related} collectionName={item.collectionName} />
          <FicheReviews source={source} externalId={id} />
          {/* Editorial context — renders only when a title-linked article exists. */}
          <FicheArticles articles={titleArticles} titleLabel={item.title} />
        </div>
      </div>
    </AppShell>
  );
}
