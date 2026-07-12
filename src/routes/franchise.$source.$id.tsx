import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers, Network } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SafeImage } from "@/components/media/SafeImage";
import { FicheSection } from "@/components/media/FicheSection";
import { EmptyState } from "@/components/media/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { mediaDetailQO } from "@/lib/queries";
import { anilistPublicDetail } from "@/lib/anilist-public";
import {
  buildFranchiseGroup,
  decadeOf,
  isRealGroup,
  type FranchiseGroup,
} from "@/lib/franchise";
import {
  FORMAT_GROUP_LABELS,
  type FormatGroup,
  type RelatedMedia,
} from "@/lib/media-types";

export const Route = createFileRoute("/franchise/$source/$id")({
  loader: async ({ context, params }) => {
    const item = await context.queryClient.ensureQueryData(
      mediaDetailQO(params.source, params.id),
    );
    if (!item) throw notFound();
    return { item };
  },
  head: ({ loaderData, params }) => {
    const canonical = `https://kazen.lovable.app/franchise/${params.source}/${params.id}`;
    const item = loaderData?.item;
    if (!item) {
      return {
        meta: [
          { title: "Groupe introuvable — KAZEN" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `Groupe : ${item.title} — Univers complet — KAZEN`;
    const description = `Tout l'univers de ${item.title} sur KAZEN : animes, manga, light novels, musiques et contenus liés, ordonnés et filtrables.`;
    const image = item.backdropUrl || item.posterUrl;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: GroupPage,
  pendingComponent: () => (
    <AppShell>
      <div className="space-y-6 py-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-7">
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-xl" />
          ))}
        </div>
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Groupe introuvable</h1>
        <p className="mt-2 text-muted-foreground">Cet univers n'est pas disponible.</p>
        <Button asChild className="mt-6">
          <Link to="/">Retour à la découverte</Link>
        </Button>
      </div>
    </AppShell>
  ),
});

function GroupPage() {
  const { source, id } = Route.useParams();
  const { data: item } = useSuspenseQuery(mediaDetailQO(source, id));
  const group = useMemo<FranchiseGroup | null>(
    () => (item ? buildFranchiseGroup(item) : null),
    [item],
  );

  const [typeFilter, setTypeFilter] = useState<FormatGroup | "all">("all");
  const [decadeFilter, setDecadeFilter] = useState<string | "all">("all");

  if (!item || !group || !isRealGroup(group)) {
    return (
      <AppShell>
        <div className="py-24 text-center">
          <h1 className="font-display text-2xl font-bold">Pas de groupe pour ce titre</h1>
          <p className="mt-2 text-muted-foreground">
            Cette œuvre n'appartient pas à un univers regroupant plusieurs contenus.
          </p>
          <Button asChild className="mt-6">
            <Link to="/media/$source/$id" params={{ source, id }}>
              Retour à la fiche
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const decades = Array.from(new Set(group.years.map(decadeOf)));

  const sections = group.sections
    .filter((s) => typeFilter === "all" || s.formatGroup === typeFilter)
    .map((s) => ({
      ...s,
      items: s.items.filter(
        (i) => decadeFilter === "all" || (i.year != null && decadeOf(i.year) === decadeFilter),
      ),
    }))
    .filter((s) => s.items.length > 0);

  const total = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4">
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="w-fit border border-white/10"
        >
          <Link to="/media/$source/$id" params={{ source, id }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Retour à la fiche
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <span className="rounded-full aurora-bg p-2 text-white">
            <Network className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Groupe / Franchise
            </p>
            <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
              {item.title}
            </h1>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Tout l'univers regroupé : {group.items.length} contenus liés (
          {group.sections.map((s) => FORMAT_GROUP_LABELS[s.formatGroup]).join(", ")}),
          ordonnés par année et par format.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 space-y-3">
        <FilterRow label="Type">
          <Chip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
            Tous
          </Chip>
          {group.sections.map((s) => (
            <Chip
              key={s.formatGroup}
              active={typeFilter === s.formatGroup}
              onClick={() => setTypeFilter(s.formatGroup)}
            >
              {FORMAT_GROUP_LABELS[s.formatGroup]}
            </Chip>
          ))}
        </FilterRow>
        {decades.length > 1 ? (
          <FilterRow label="Époque">
            <Chip active={decadeFilter === "all"} onClick={() => setDecadeFilter("all")}>
              Toutes
            </Chip>
            {decades.map((d) => (
              <Chip key={d} active={decadeFilter === d} onClick={() => setDecadeFilter(d)}>
                {d}
              </Chip>
            ))}
          </FilterRow>
        ) : null}
      </div>

      {total === 0 ? (
        <EmptyState message="Aucun contenu pour ce filtre" hint="Essayez un autre type ou une autre époque." />
      ) : (
        <div className="space-y-10">
          {sections.map((s) => (
            <FicheSection
              key={s.formatGroup}
              title={s.title}
              icon={<Layers className="h-5 w-5" />}
              action={
                <span className="text-sm text-muted-foreground">{s.items.length}</span>
              }
            >
              <div className="cv-auto grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
                {s.items.map((it) => (
                  <GroupCard key={it.key} it={it} isSelf={it.key === item.key} />
                ))}
              </div>
            </FicheSection>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
        active
          ? "border-transparent aurora-bg text-white"
          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function GroupCard({ it, isSelf }: { it: RelatedMedia; isSelf: boolean }) {
  const clickable = it.hasDetail !== false && !isSelf;
  const inner = (
    <>
      <div
        className={cn(
          "relative aspect-[2/3] overflow-hidden rounded-xl border bg-muted",
          isSelf ? "border-primary" : "border-border",
        )}
      >
        <SafeImage
          src={it.posterUrl}
          alt={it.title}
          variant="poster"
          fallbackLabel={it.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-1.5 top-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[0.6rem] font-semibold backdrop-blur">
          {it.relation}
        </span>
        {it.year ? (
          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[0.6rem] font-medium text-muted-foreground backdrop-blur">
            {it.year}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-tight group-hover:text-primary">
        {it.title}
      </p>
    </>
  );

  if (!clickable) return <div className="group cursor-default">{inner}</div>;
  return (
    <Link
      to="/media/$source/$id"
      params={{ source: it.source, id: it.externalId }}
      className="group block focus-visible:outline-none"
    >
      {inner}
    </Link>
  );
}
