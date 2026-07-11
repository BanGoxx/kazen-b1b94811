import { useMemo, useState } from "react";
import type { MediaItem } from "@/lib/media-types";
import { collectGenres, filterItems, sortItems } from "@/lib/media-filters";
import { FilterBar, type FilterState } from "./FilterBar";
import { MediaGrid } from "./MediaGrid";

// Stateful, reusable filterable grid: genre + status filters and sorting over
// a preloaded MediaItem list. Used by the Anime / Séries / Films catalogues.
export function CatalogGrid({
  items,
  emptyLabel,
}: {
  items: MediaItem[];
  emptyLabel?: string;
}) {
  const [state, setState] = useState<FilterState>({
    genres: [],
    status: "all",
    sort: "trending",
  });

  const genres = useMemo(() => collectGenres(items), [items]);

  const visible = useMemo(() => {
    const filtered = filterItems(items, { genres: state.genres, status: state.status });
    return sortItems(filtered, state.sort);
  }, [items, state]);

  const sourceEmpty = items.length === 0;

  return (
    <div>
      <FilterBar
        genres={genres}
        state={state}
        onChange={setState}
        resultCount={visible.length}
      />
      <MediaGrid
        items={visible}
        emptyLabel={
          sourceEmpty
            ? (emptyLabel ?? "Aucun titre à afficher pour le moment. Revenez bientôt.")
            : "Aucun titre ne correspond à ces filtres."
        }
      />
    </div>
  );
}
