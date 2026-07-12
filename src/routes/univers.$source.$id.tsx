import { useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SafeImage } from "@/components/media/SafeImage";
import { EmptyState } from "@/components/media/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { mediaDetailQO } from "@/lib/queries";
import {
  buildFranchiseGroup,
  isRealGroup,
  itemsByUniversCategory,
  isUniversCategory,
  UNIVERS_CATEGORY_LABELS,
  UNIVERS_CATEGORY_ORDER,
  DEFAULT_UNIVERS_CATEGORY,
  type FranchiseGroup,
  type UniversCategory,
} from "@/lib/franchise";
import type { RelatedMedia } from "@/lib/media-types";

interface UniversSearch {
  type: UniversCategory;
}

const EMPTY_COPY: Record<UniversCategory, string> = {
  anime: "Aucun anime associé pour cet univers pour le moment.",
  manga: "Aucun manga associé pour cet univers pour le moment.",
  novel: "Aucun light novel associé pour cet univers pour le moment.",
  oav: "Aucun OAV ni épisode spécial associé pour le moment.",
  movie: "Aucun film associé pour cet univers pour le moment.",
  music: "Aucune bande originale (OST / CD) associée pour le moment.",
  goodies: "Aucun goodies ou produit associé pour le moment.",
  disc: "Aucune édition DVD / Blu-ray référencée pour le moment.",
  doujinshi: "Aucun doujinshi référencé pour cet univers pour le moment.",
};

export const Route = createFileRoute("/univers/$source/$id")({
  validateSearch: (search: Record<string, unknown>): UniversSearch => ({
    type: isUniversCategory(search.type) ? search.type : DEFAULT_UNIVERS_CATEGORY,
  }),
  loader: async ({ context, params }) => {
    const item = await context.queryClient.ensureQueryData(
      mediaDetailQO(params.source, params.id),
    );
    if (!item) throw notFound();
    return { item };
  },
  head: ({ loaderData, params }) => {
    const canonical = `https://kazen.lovable.app/univers/${params.source}/${params.id}`;
    const item = loaderData?.item;
    if (!item) {
      return {
        meta: [
          { title: "Univers introuvable — KAZEN" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `Univers : ${item.title} — KAZEN`;
    const description = `Explorez tout l'univers de ${item.title} sur KAZEN : animes, films, OAV, mangas, light novels, OST et goodies, organisés par catégorie.`;
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
  component: UniversPage,
  pendingComponent: () => (
    <AppShell>
      <div className="space-y-6 py-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-9 w-full max-w-2xl" />
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
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
        <h1 className="font-display text-2xl font-bold">Univers introuvable</h1>
        <p className="mt-2 text-muted-foreground">Cet univers n'est pas disponible.</p>
        <Button asChild className="mt-6">
          <Link to="/">Retour à la découverte</Link>
        </Button>
      </div>
    </AppShell>
  ),
});

function UniversPage() {
  const { source, id } = Route.useParams();
  const { type } = Route.useSearch();
  const { data: item } = useSuspenseQuery(mediaDetailQO(source, id));

  const group = useMemo<FranchiseGroup | null>(
    () => (item ? buildFranchiseGroup(item) : null),
    [item],
  );
  const buckets = useMemo(
    () => (group ? itemsByUniversCategory(group) : null),
    [group],
  );

  if (!item || !group || !buckets || !isRealGroup(group)) {
    return (
      <AppShell>
        <div className="py-24 text-center">
          <h1 className="font-display text-2xl font-bold">Pas d'univers pour ce titre</h1>
          <p className="mt-2 text-muted-foreground">
            Cette œuvre n'appartient pas encore à un univers regroupant plusieurs contenus.
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

  const activeItems = buckets[type] ?? [];
  const heroImage = item.backdropUrl || item.posterUrl;

  return (
    <AppShell>
      {/* Header */}
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

        <div className="relative overflow-hidden rounded-2xl border border-border">
          {heroImage ? (
            <SafeImage
              src={heroImage}
              alt={item.title}
              variant="backdrop"
              fallbackLabel={item.title}
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />
          ) : null}
          <div className="relative flex flex-col gap-3 bg-gradient-to-t from-background via-background/85 to-background/40 p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="rounded-full aurora-bg p-2 text-white">
                <Sparkles className="h-5 w-5" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Univers KAZEN
              </p>
            </div>
            <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
              {item.title}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Explorez tout l'univers : {group.items.length} contenus liés répartis par
              catégorie (animes, films, OAV, mangas, light novels, OST, goodies…).
            </p>
          </div>
        </div>
      </div>

      {/* URL-driven category tabs */}
      <nav aria-label="Catégories de l'univers" className="mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {UNIVERS_CATEGORY_ORDER.map((cat) => {
            const count = buckets[cat].length;
            const active = cat === type;
            return (
              <Link
                key={cat}
                to="/univers/$source/$id"
                params={{ source, id }}
                search={{ type: cat }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                  active
                    ? "border-transparent aurora-bg text-white"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {UNIVERS_CATEGORY_LABELS[cat]}
                {count > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[0.65rem] font-bold",
                      active ? "bg-white/25 text-white" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Listing */}
      <section aria-live="polite">
        <div className="mb-4 flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">
            {UNIVERS_CATEGORY_LABELS[type]}
          </h2>
          <span className="text-sm text-muted-foreground">{activeItems.length}</span>
        </div>

        {activeItems.length === 0 ? (
          <EmptyState message={EMPTY_COPY[type]} hint="Essayez une autre catégorie ci-dessus." />
        ) : (
          <div className="cv-auto grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
            {activeItems.map((it) => (
              <UniversCard key={it.key} it={it} isSelf={it.key === item.key} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function UniversCard({ it, isSelf }: { it: RelatedMedia; isSelf: boolean }) {
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
