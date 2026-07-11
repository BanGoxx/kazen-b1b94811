import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Clapperboard,
  Clock,
  Film,
  Flame,
  Globe,
  Info,
  Layers,
  ShieldCheck,
  Sparkles,
  Tv,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RatingBadge } from "@/components/media/RatingBadge";
import { SafeImage } from "@/components/media/SafeImage";
import { PlatformBadge } from "@/components/media/PlatformBadge";
import { TrailerDialog } from "@/components/media/TrailerDialog";
import { CreditScroller } from "@/components/media/CreditScroller";
import { RelatedScroller } from "@/components/media/RelatedScroller";
import { UserListPanel } from "@/components/media/UserListPanel";
import { FicheSection } from "@/components/media/FicheSection";
import { ExpandableText } from "@/components/media/ExpandableText";
import { VideoGallery } from "@/components/media/VideoGallery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MEDIA_TYPE_LABELS, STATUS_LABELS } from "@/lib/media-types";
import { mediaDetailQO } from "@/lib/queries";

export const Route = createFileRoute("/media/$source/$id")({
  loader: async ({ context, params }) => {
    const item = await context.queryClient.ensureQueryData(
      mediaDetailQO(params.source, params.id),
    );
    if (!item) throw notFound();
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
  const { data: item } = useSuspenseQuery(mediaDetailQO(source, id));
  if (!item) return null;

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

          {item.platforms.length ? (
            <div className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Disponible sur
              </h2>
              <div className="flex flex-wrap gap-2">
                {item.platforms.map((p) => (
                  <PlatformBadge key={p.id} platform={p} />
                ))}
              </div>
            </div>
          ) : null}

          <UserListPanel item={item} />
        </div>

        {/* Right column: content */}
        <div className="min-w-0 space-y-8">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full aurora-bg px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                {MEDIA_TYPE_LABELS[item.mediaType]}
              </span>
              <RatingBadge score={item.score} />
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
            {item.genres.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {item.genres.map((g) => (
                  <Badge key={g} variant="secondary">{g}</Badge>
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
            <div>
              <h2 className="mb-2 font-display text-xl font-bold">Synopsis</h2>
              <p className="max-w-3xl leading-relaxed text-muted-foreground">{item.synopsis}</p>
            </div>
          ) : null}

          {item.collectionName ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 p-4">
              <Layers className="h-5 w-5 text-primary" />
              <span className="text-sm">
                Fait partie de la saga <strong className="font-semibold">{item.collectionName}</strong>
              </span>
            </div>
          ) : null}

          <CreditScroller title={item.castLabel} people={item.cast} />
          <CreditScroller title={item.crewLabel} people={item.crew} />
          <RelatedScroller title="À découvrir aussi" items={item.related} />
        </div>
      </div>
    </AppShell>
  );
}
