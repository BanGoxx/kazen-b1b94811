import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Clapperboard,
  Clock,
  Flame,
  Layers,
  Sparkles,
  Tv,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RatingBadge } from "@/components/media/RatingBadge";
import { PlatformBadge } from "@/components/media/PlatformBadge";
import { TrailerDialog } from "@/components/media/TrailerDialog";
import { CreditScroller } from "@/components/media/CreditScroller";
import { RelatedScroller } from "@/components/media/RelatedScroller";
import { UserListPanel } from "@/components/media/UserListPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MEDIA_TYPE_LABELS, STATUS_LABELS } from "@/lib/media-types";
import { mediaDetailQO } from "@/lib/queries";

export const Route = createFileRoute("/media/$source/$id")({
  loader: async ({ context, params }) => {
    const item = await context.queryClient.ensureQueryData(
      mediaDetailQO(params.source, params.id),
    );
    if (!item) throw notFound();
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Fiche introuvable — KAZEN" }] };
    return { meta: [{ title: "Fiche — KAZEN" }] };
  },
  component: MediaDetailPage,
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

  return (
    <AppShell>
      {/* Cinematic backdrop */}
      <div className="relative -mx-4 -mt-8 mb-0 h-64 overflow-hidden sm:-mx-6 sm:h-80 lg:-mx-10 lg:h-[26rem]">
        {item.backdropUrl ? (
          <img src={item.backdropUrl} alt="" className="h-full w-full scale-105 object-cover" />
        ) : (
          <div className="h-full w-full aurora-bg opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 to-transparent" />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.history.back()}
          className="absolute left-4 top-4 sm:left-6"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Button>
      </div>

      <div className="relative -mt-28 grid gap-8 sm:-mt-32 lg:grid-cols-[300px_1fr] lg:-mt-40">
        {/* Left column: poster + platforms + user panel */}
        <div className="space-y-5">
          <div className="mx-auto w-44 sm:w-52 lg:mx-0 lg:w-full">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-lg)]">
              {item.posterUrl ? (
                <img src={item.posterUrl} alt={item.title} className="aspect-[2/3] w-full object-cover" />
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
        <div className="space-y-8">
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
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
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
                  <div key={f.label} className="rounded-xl border border-border bg-card/60 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" /> {f.label}
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
