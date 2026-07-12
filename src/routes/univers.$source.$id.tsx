import { useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowDownWideNarrow, Layers, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SafeImage } from "@/components/media/SafeImage";
import { EmptyState } from "@/components/media/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { mediaDetailQO } from "@/lib/queries";
import { anilistPublicDetail } from "@/lib/anilist-public";
import {
  buildFranchiseGroup,
  isRealGroup,
  itemsByUniversCategory,
  isUniversCategory,
  isUniversSort,
  sortUniversItems,
  distinctYears,
  filterByYear,
  UNIVERS_CATEGORY_LABELS,
  UNIVERS_CATEGORY_ORDER,
  UNIVERS_SORT_ORDER,
  UNIVERS_SORT_LABELS,
  DEFAULT_UNIVERS_CATEGORY,
  DEFAULT_UNIVERS_SORT,
  type FranchiseGroup,
  type UniversCategory,
  type UniversSort,
} from "@/lib/franchise";
import type { RelatedMedia } from "@/lib/media-types";

interface UniversSearch {
  type: UniversCategory;
  sort: UniversSort;
  year: number | null;
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
  validateSearch: (search: Record<string, unknown>): UniversSearch => {
    const rawYear = Number(search.year);
    return {
      type: isUniversCategory(search.type) ? search.type : DEFAULT_UNIVERS_CATEGORY,
      sort: isUniversSort(search.sort) ? search.sort : DEFAULT_UNIVERS_SORT,
      year: Number.isFinite(rawYear) && rawYear > 0 ? Math.trunc(rawYear) : null,
    };
  },

  loader: async ({ context, params }) => {
    const item = await context.queryClient.ensureQueryData(
      mediaDetailQO(params.source, params.id),
    );
    // For AniList, the production Worker can be 403-blocked (null item); the
    // component recovers via the browser-direct path. Only 404 non-AniList.
    if (!item && params.source !== "anilist") throw notFound();
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
  const { type, sort, year } = Route.useSearch() as UniversSearch;

  const { data: serverItem } = useSuspenseQuery(mediaDetailQO(source, id));
  // Recover rich universe data via browser-direct AniList when the server item
  // is missing or its relations are empty (production Worker 403).
  const needsBrowserDetail =
    source === "anilist" && (!serverItem || !serverItem.related.length);
  const browserDetail = useQuery({
    queryKey: ["media", "anilist-public-detail", id],
    queryFn: () => anilistPublicDetail(Number(id)),
    enabled: needsBrowserDetail && typeof window !== "undefined" && Number.isFinite(Number(id)),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
  const item = source === "anilist" ? (browserDetail.data ?? serverItem) : serverItem;

  const group = useMemo<FranchiseGroup | null>(
    () => (item ? buildFranchiseGroup(item) : null),
    [item],
  );
  const buckets = useMemo(
    () => (group ? itemsByUniversCategory(group) : null),
    [group],
  );

  if (source === "anilist" && !serverItem && browserDetail.isPending) {
    return (
      <AppShell>
        <div className="py-24 text-center">
          <h1 className="font-display text-2xl font-bold">Chargement de l'univers…</h1>
          <p className="mt-2 text-muted-foreground">Récupération des données liées depuis AniList.</p>
          <div className="mx-auto mt-6 h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      </AppShell>
    );
  }


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

  const categoryItems = buckets[type] ?? [];
  // Available years come from the full category (before the year filter) so the
  // year selector never hides the option the user is currently viewing.
  const years = distinctYears(categoryItems);
  // Reset a stale year when it no longer exists in the active category.
  const activeYear = year !== null && years.includes(year) ? year : null;
  const activeItems = sortUniversItems(filterByYear(categoryItems, activeYear), sort);
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
                search={{ type: cat, sort, year: null }}

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

      {/* Sort + year filters (operate within the active tab) */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div
          className="flex items-center gap-1 rounded-full border border-border bg-card/60 p-1"
          role="group"
          aria-label="Trier"
        >
          <ArrowDownWideNarrow className="ml-1.5 h-4 w-4 text-muted-foreground" />
          {UNIVERS_SORT_ORDER.map((mode) => {
            const active = mode === sort;
            return (
              <Link
                key={mode}
                to="/univers/$source/$id"
                params={{ source, id }}
                search={{ type, sort: mode, year: activeYear }}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "focus-ring rounded-full px-3 py-1 text-xs font-semibold transition-colors sm:text-sm",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {UNIVERS_SORT_LABELS[mode]}
              </Link>
            );
          })}
        </div>

        {years.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              to="/univers/$source/$id"
              params={{ source, id }}
              search={{ type, sort, year: null }}
              aria-current={activeYear === null ? "true" : undefined}
              className={cn(
                "focus-ring rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                activeYear === null
                  ? "border-transparent aurora-bg text-white"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
              )}
            >
              Toutes années
            </Link>
            {years.map((y) => {
              const active = y === activeYear;
              return (
                <Link
                  key={y}
                  to="/univers/$source/$id"
                  params={{ source, id }}
                  search={{ type, sort, year: y }}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "focus-ring rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    active
                      ? "border-transparent aurora-bg text-white"
                      : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {y}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>

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
          activeYear !== null ? (
            <EmptyState
              message={`Aucun titre pour l'année ${activeYear} dans cette catégorie.`}
              hint="Choisissez « Toutes années » ou une autre année."
            />
          ) : (
            <EmptyState message={EMPTY_COPY[type]} hint="Essayez une autre catégorie ci-dessus." />
          )
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
  // Any real AniList id resolves internally (universal detail + browser-direct
  // fallback), so manga/LN sources stay navigable instead of dead cards.
  const anilistReal = it.source === "anilist" && /^\d+$/.test(it.externalId);
  const clickable = (anilistReal || it.hasDetail !== false) && !isSelf;
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
