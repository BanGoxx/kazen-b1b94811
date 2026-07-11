import { useMemo, useState } from "react";
import { useSuspenseInfiniteQuery, type UseSuspenseInfiniteQueryOptions } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import type { MediaItem } from "@/lib/media-types";
import type { PagedMedia } from "@/lib/tmdb.server";
import { collectGenres, filterItems, sortItems } from "@/lib/media-filters";
import { FilterBar, type FilterState } from "./FilterBar";
import { MediaGrid } from "./MediaGrid";
import { Button } from "@/components/ui/button";

// Reusable filterable catalogue backed by an infinite query. Results load one
// page at a time on user request ("Voir plus"), never in parallel, so the
// AniList queue and TMDB safeguards stay intact. Client-side genre/status
// filters and sorting apply over everything already loaded.
export function PaginatedCatalog({
  queryOptions,
  emptyLabel,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryOptions: UseSuspenseInfiniteQueryOptions<PagedMedia, Error, any, any, any>;
  emptyLabel?: string;
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
      {query.hasNextPage ? (
        <div className="mt-8 flex flex-col items-center gap-2">
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
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Voir plus de titres
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">{items.length} titres chargés</p>
        </div>
      ) : items.length > 0 ? (
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Vous avez atteint la fin du catalogue · {items.length} titres
        </p>
      ) : null}
    </div>
  );
}
