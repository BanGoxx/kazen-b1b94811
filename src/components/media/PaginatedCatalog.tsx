import { useEffect, useMemo, useRef, useState } from "react";
import { useSuspenseInfiniteQuery, type UseSuspenseInfiniteQueryOptions } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import type { MediaItem } from "@/lib/media-types";
import type { PagedMedia } from "@/lib/tmdb.server";
import { collectGenres, filterItems, sortItems } from "@/lib/media-filters";
import { FilterBar, type FilterState } from "./FilterBar";
import { MediaGrid } from "./MediaGrid";
import { SafeSection } from "./SafeSection";
import { CatalogLoading, SlowLoadHint } from "./LoadingHint";
import { Button } from "@/components/ui/button";

// Titles auto-loaded via scroll before we require an explicit click. This keeps
// the first screens fluid (near-infinite) while capping automatic fetches so we
// never hammer AniList/TMDB. Beyond the cap the user opts in with "Voir plus".
const AUTO_LOAD_CAP = 600;

// Reusable filterable catalogue backed by an infinite query. Pages load one at a
// time (hybrid: auto on scroll up to a cap, then manual button) — never in
// parallel — so the AniList queue and TMDB safeguards stay intact. Client-side
// genre/status filters and sorting apply over everything already loaded.
//
// PRESERVATION RULE (KAZEN): infinite scroll + the "Voir plus" fallback are
// expected catalog behavior. Do not remove them during visual/design polish.
// If anime catalogs ever stop paginating, check AniList upstream (403/rate
// limiting) first — the curated fallback returns hasMore:false by design.
export function PaginatedCatalog(props: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryOptions: UseSuspenseInfiniteQueryOptions<PagedMedia, Error, any, any, any>;
  emptyLabel?: string;
  // Message shown once every available provider page is loaded. Defaults to a
  // "complete catalogue" phrasing; pass a season/upcoming-specific note when
  // the total is a genuine complete set rather than an open-ended catalogue.
  completionLabel?: string;
}) {
  return (
    <SafeSection minHeight="20rem" pending={<CatalogPending />}>
      <CatalogInner {...props} />
    </SafeSection>
  );
}

function CatalogPending() {
  return <CatalogLoading count={10} />;
}

function CatalogInner({
  queryOptions,
  emptyLabel,
  completionLabel,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryOptions: UseSuspenseInfiniteQueryOptions<PagedMedia, Error, any, any, any>;
  emptyLabel?: string;
  completionLabel?: string;
}) {
  const query = useSuspenseInfiniteQuery(queryOptions);
  const [state, setState] = useState<FilterState>({
    genres: [],
    status: "all",
    sort: "trending",
  });

  const items = useMemo<MediaItem[]>(
    () => (query.data?.pages ?? []).flatMap((p: PagedMedia) => p.items),
    [query.data],
  );

  const genres = useMemo(() => collectGenres(items), [items]);

  const visible = useMemo(() => {
    const filtered = filterItems(items, { genres: state.genres, status: state.status });
    return sortItems(filtered, state.sort);
  }, [items, state]);

  const sourceEmpty = items.length === 0;

  // Auto-load on scroll until the cap, one sequential page at a time.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const canAutoLoad = query.hasNextPage && items.length < AUTO_LOAD_CAP;
  useEffect(() => {
    if (!canAutoLoad) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [canAutoLoad, query]);

  return (
    <div>
      <FilterBar genres={genres} state={state} onChange={setState} resultCount={visible.length} />
      <MediaGrid
        items={visible}
        emptyLabel={
          sourceEmpty
            ? (emptyLabel ?? "Aucun titre à afficher pour le moment. Revenez bientôt.")
            : "Aucun titre ne correspond à ces filtres."
        }
      />

      {/* Invisible sentinel drives near-infinite scrolling up to the cap. */}
      {canAutoLoad ? <div ref={sentinelRef} aria-hidden className="h-1 w-full" /> : null}

      {query.hasNextPage ? (
        <div className="mt-8 flex flex-col items-center gap-2">
          {/* A failed next-page fetch (transient AniList 403/429/timeout) must
              surface as an explicit retry — never as a silently re-enabled
              button that forces the user to click blindly several times. */}
          {query.isFetchNextPageError ? (
            <p className="text-xs text-destructive" role="status">
              Le chargement a échoué. Réessayez.
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="min-w-[12rem] rounded-full"
          >
            {query.isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement des anime…
              </>
            ) : query.isFetchNextPageError ? (
              <>
                <RotateCw className="h-4 w-4" /> Réessayer
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Voir plus de titres
              </>
            )}
          </Button>
          {query.isFetchingNextPage ? (
            <SlowLoadHint />
          ) : query.isFetchNextPageError ? (
            <p className="text-xs text-muted-foreground">Connexion à la source de données…</p>
          ) : (
            <p className="text-xs text-muted-foreground">{items.length} titres chargés</p>
          )}
        </div>
      ) : items.length > 0 ? (
        <p className="mt-8 text-center text-xs text-muted-foreground">
          {completionLabel ?? "Tous les titres disponibles sont affichés"} · {items.length} titres
        </p>
      ) : null}
    </div>
  );
}
