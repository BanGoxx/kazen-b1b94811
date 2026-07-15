import { Filter, X } from "lucide-react";
import type { MediaStatus } from "@/lib/media-types";
import { SORT_OPTIONS, type SortKey } from "@/lib/media-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useMediaStatusLabels } from "@/lib/i18n/tracking";

export interface FilterState {
  genres: string[];
  status: MediaStatus | "all";
  sort: SortKey;
}

export function FilterBar({
  genres,
  state,
  onChange,
  resultCount,
}: {
  genres: string[];
  state: FilterState;
  onChange: (next: FilterState) => void;
  resultCount: number;
}) {
  const { t } = useI18n();
  const mediaStatus = useMediaStatusLabels();

  const STATUS_FILTERS: { value: MediaStatus | "all"; label: string }[] = [
    { value: "all", label: t.catalog.all },
    { value: "en_cours", label: mediaStatus.en_cours },
    { value: "a_venir", label: mediaStatus.a_venir },
    { value: "termine", label: mediaStatus.termine },
  ];

  const toggleGenre = (g: string) => {
    const has = state.genres.includes(g);
    onChange({
      ...state,
      genres: has ? state.genres.filter((x) => x !== g) : [...state.genres, g],
    });
  };

  const hasFilters = state.genres.length > 0 || state.status !== "all";
  const countLabel = resultCount > 1 ? t.catalog.resultsOther : t.catalog.resultsOne;

  return (
    <div className="mb-6 space-y-4 rounded-2xl border border-border bg-card/50 p-4 backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4 text-primary" />
          {t.catalog.filters}
          <span className="text-xs font-normal text-muted-foreground">
            · {resultCount} {countLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasFilters ? (
            <button
              type="button"
              onClick={() => onChange({ ...state, genres: [], status: "all" })}
              className="focus-ring inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> {t.catalog.reset}
            </button>
          ) : null}
          <Select
            value={state.sort}
            onValueChange={(v) => onChange({ ...state, sort: v as SortKey })}
          >
            <SelectTrigger className="h-9 w-[10.5rem]" aria-label={t.catalog.sort}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {t.catalog.sortPrefix} : {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => {
          const active = state.status === s.value;
          return (
            <button
              key={s.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...state, status: s.value })}
              className={cn(
                "focus-ring rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                active
                  ? "border-transparent aurora-bg text-white"
                  : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {genres.length ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
          {genres.map((g) => {
            const active = state.genres.includes(g);
            return (
              <button
                key={g}
                type="button"
                aria-pressed={active}
                onClick={() => toggleGenre(g)}
                className={cn(
                  "focus-ring rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {g}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
