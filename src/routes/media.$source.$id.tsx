import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Clapperboard, Clock, Layers } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RatingBadge } from "@/components/media/RatingBadge";
import { PlatformBadge } from "@/components/media/PlatformBadge";
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
    if (!loaderData) return { meta: [{ title: "Fiche introuvable — NEXUS MEDIA" }] };
    return { meta: [{ title: "Fiche — NEXUS MEDIA" }] };
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
  const { data: item } = useSuspenseQuery(mediaDetailQO(source, id));
  if (!item) return null;

  const released = fmtDate(item.releaseDate);
  const facts: { icon: typeof Calendar; label: string; value: string }[] = [];
  if (released) facts.push({ icon: Calendar, label: "Sortie", value: released });
  if (item.episodesCount) facts.push({ icon: Layers, label: "Épisodes", value: String(item.episodesCount) });
  if (item.seasonsCount) facts.push({ icon: Layers, label: "Saisons", value: String(item.seasonsCount) });
  if (item.runtime) facts.push({ icon: Clock, label: "Durée", value: `${item.runtime} min` });
  if (item.status) facts.push({ icon: Clapperboard, label: "Statut", value: STATUS_LABELS[item.status] });

  return (
    <AppShell>
      <div className="relative -mx-4 -mt-8 mb-8 h-56 overflow-hidden sm:-mx-6 sm:h-72 lg:-mx-10 lg:h-80">
        {item.backdropUrl ? (
          <img src={item.backdropUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full aurora-bg opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <Button asChild variant="secondary" size="sm" className="absolute left-4 top-4 sm:left-6">
          <button onClick={() => history.back()}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Retour
          </button>
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <div className="mx-auto w-48 shrink-0 lg:mx-0 lg:w-full">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-lg)]">
            {item.posterUrl ? (
              <img src={item.posterUrl} alt={item.title} className="aspect-[2/3] w-full object-cover" />
            ) : (
              <div className="aspect-[2/3] w-full aurora-bg opacity-40" />
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full aurora-bg px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                {MEDIA_TYPE_LABELS[item.mediaType]}
              </span>
              <RatingBadge score={item.score} />
            </div>
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              {item.title}
            </h1>
            {item.titleOriginal && item.titleOriginal !== item.title ? (
              <p className="text-muted-foreground">{item.titleOriginal}</p>
            ) : null}
            {item.genres.length ? (
              <div className="flex flex-wrap gap-2">
                {item.genres.map((g) => (
                  <Badge key={g} variant="secondary">{g}</Badge>
                ))}
              </div>
            ) : null}
          </div>

          {item.platforms.length ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Disponible sur</h2>
              <div className="flex flex-wrap gap-2">
                {item.platforms.map((p) => (
                  <PlatformBadge key={p.id} platform={p} />
                ))}
              </div>
            </div>
          ) : null}

          {facts.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
              <p className="leading-relaxed text-muted-foreground">{item.synopsis}</p>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
