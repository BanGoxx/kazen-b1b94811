import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, TrendingUp, Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchMediaQO, trendingAnimeQO, trendingMoviesQO, trendingSeriesQO } from "@/lib/queries";
import { rankSuggestions } from "@/lib/search-rank";
import { MEDIA_TYPE_LABELS, type MediaItem } from "@/lib/media-types";

function itemYear(item: MediaItem): string | null {
  if (!item.releaseDate) return null;
  const y = item.releaseDate.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : null;
}

// Interleave the top trending anime / series / movies into one short list so
// the "on focus" preview already shows real popular titles (with posters and
// scores) before the user types. These pools are the same React-Query-cached
// queries used on the homepage, so this adds no extra API calls.
function blendTrending(
  anime: MediaItem[] | undefined,
  series: MediaItem[] | undefined,
  movies: MediaItem[] | undefined,
  limit = 6,
): MediaItem[] {
  const lists = [anime ?? [], movies ?? [], series ?? []];
  const out: MediaItem[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < limit && i < 12; i++) {
    for (const list of lists) {
      const item = list[i];
      if (item && !seen.has(item.key)) {
        seen.add(item.key);
        out.push(item);
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}


/**
 * Premium predictive search field with a live dropdown preview.
 * Ranking blends prefix + light fuzzy matching with popularity/score
 * (see rankSuggestions). Requests are debounced and cached by React Query;
 * AniList/TMDB server protections are untouched.
 */
export function SearchAutocomplete({
  className,
  inputClassName,
  autoFocus,
  initialValue = "",
  placeholder = "Rechercher un anime, une série, un film…",
  showExploreButton = true,
}: {
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  initialValue?: string;
  placeholder?: string;
  showExploreButton?: boolean;
}) {
  const [q, setQ] = useState(initialValue);
  const [debounced, setDebounced] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = "kazen-search-suggestions";

  // Debounce the network query (250ms) — avoids API spam while typing.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const { data, isFetching } = useQuery(searchMediaQO(debounced));

  const showPopular = q.trim().length < 2;

  // Trending pools for the "on focus, before typing" preview. Only fetched
  // once the field is focused and empty; otherwise these reuse the homepage
  // React-Query cache, so no extra API pressure.
  const trendingEnabled = open && showPopular;
  const { data: trAnime } = useQuery({ ...trendingAnimeQO, enabled: trendingEnabled });
  const { data: trMovies } = useQuery({ ...trendingMoviesQO, enabled: trendingEnabled });
  const { data: trSeries } = useQuery({ ...trendingSeriesQO, enabled: trendingEnabled });

  const popularItems = useMemo(
    () => blendTrending(trAnime, trMovies, trSeries, 6),
    [trAnime, trMovies, trSeries],
  );

  const suggestions = useMemo(() => {
    if (!debounced || debounced.length < 2) return [];
    return rankSuggestions(
      debounced,
      { anime: data?.anime, series: data?.series, movies: data?.movies },
      7,
    );
  }, [debounced, data]);

  const items = showPopular ? popularItems : suggestions;
  const hasContent = items.length > 0 || isFetching;
  const panelOpen = open && hasContent;

  // Reset keyboard highlight whenever the list changes.
  useEffect(() => setActive(-1), [debounced, panelOpen]);

  const goToQuery = (value: string) => {
    setOpen(false);
    navigate({ to: "/recherche", search: { q: value.trim() || undefined } });
  };

  const goToItem = (item: MediaItem) => {
    setOpen(false);
    navigate({ to: "/media/$source/$id", params: { source: item.source, id: item.externalId } });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!panelOpen) return;
    const max = items.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % max);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + max) % max);
    } else if (e.key === "Enter") {
      if (active >= 0 && items[active]) {
        e.preventDefault();
        goToItem(items[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };


  // Close when focus leaves the whole widget.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={rootRef} className={cn("relative w-full max-w-xl", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          goToQuery(q);
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Rechercher"
          role="combobox"
          aria-expanded={panelOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
          className={cn(
            "focus-ring h-14 w-full rounded-2xl border border-border bg-card/70 pl-12 text-base text-foreground shadow-card backdrop-blur placeholder:text-muted-foreground",
            showExploreButton ? "pr-28" : "pr-4",
            inputClassName,
          )}
        />
        {isFetching && !showPopular ? (
          <Loader2
            className={cn(
              "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground",
              showExploreButton ? "right-28" : "right-4",
            )}
            aria-hidden="true"
          />
        ) : null}
        {showExploreButton ? (
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl aurora-bg px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-opacity hover:opacity-90 focus-ring"
          >
            Explorer
          </button>
        ) : null}
      </form>

      {panelOpen ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-popover/95 p-1.5 shadow-float backdrop-blur"
        >
          <p className="flex items-center gap-1.5 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {showPopular ? (
              <>
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Populaires en ce moment
              </>
            ) : (
              "Suggestions"
            )}
          </p>

          {items.length > 0
            ? items.map((item, i) => {
                const year = itemYear(item);
                return (
                  <button
                    key={item.key}
                    id={`${listId}-opt-${i}`}
                    role="option"
                    aria-selected={active === i}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goToItem(item)}
                    className={cn(
                      "focus-ring flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                      active === i ? "bg-muted" : "hover:bg-muted",
                    )}
                  >
                    <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.posterUrl ? (
                        <img
                          src={item.posterUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-[0.72rem] text-muted-foreground">
                        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-medium text-primary">
                          {MEDIA_TYPE_LABELS[item.mediaType]}
                        </span>
                        {year ? <span>{year}</span> : null}
                        {item.score != null ? (
                          <span className="inline-flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-current text-amber-400" />
                            {(item.score / 10).toFixed(1)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            : (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                {isFetching ? "Recherche…" : "Aucun résultat"}
              </p>
            )}

        </div>
      ) : null}
    </div>
  );
}
