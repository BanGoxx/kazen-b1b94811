import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Check, Loader2 } from "lucide-react";
import { searchMediaQO } from "@/lib/queries";
import { MEDIA_TYPE_LABELS, type MediaItem } from "@/lib/media-types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/media/SafeImage";
import { PlatformBadge } from "@/components/media/PlatformBadge";
import { MissingTitleRequest } from "@/components/media/MissingTitleRequest";
import { useDebounce } from "@/hooks/use-debounce";

function year(date: string | null): string | null {
  if (!date) return null;
  const m = /^(\d{4})/.exec(date);
  return m ? m[1] : null;
}

function ResultRow({
  item,
  onAdd,
  added,
  busy,
}: {
  item: MediaItem;
  onAdd: (item: MediaItem) => void;
  added: boolean;
  busy: boolean;
}) {
  const y = year(item.releaseDate);
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card/40 p-2.5">
      <SafeImage
        src={item.posterUrl}
        alt={item.title}
        fallbackLabel={item.title}
        className="h-20 w-14 shrink-0 rounded-md object-cover ring-1 ring-border"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-primary">
            {MEDIA_TYPE_LABELS[item.mediaType]}
          </span>
          {y && <span className="text-xs text-muted-foreground">{y}</span>}
          {typeof item.score === "number" && (
            <span className="text-xs text-muted-foreground">★ {item.score.toFixed(1)}</span>
          )}
        </div>
        <h4 className="line-clamp-1 text-sm font-semibold text-foreground">{item.title}</h4>
        {item.genres.length > 0 && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {item.genres.slice(0, 3).join(" · ")}
          </p>
        )}
        {item.synopsis && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground/90">
            {item.synopsis}
          </p>
        )}
        {item.platforms.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {item.platforms.slice(0, 3).map((p) => (
              <PlatformBadge key={p.id} platform={p} />
            ))}
          </div>
        )}
      </div>
      <Button
        variant={added ? "outline" : "aurora"}
        size="sm"
        className="shrink-0 gap-1"
        disabled={busy || added}
        onClick={() => onAdd(item)}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : added ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">{added ? "Ajouté" : "Ajouter"}</span>
      </Button>
    </div>
  );
}

/**
 * Reusable media search used inside playlist creation/editing. Reuses the
 * existing KAZEN search (AniList + TMDB via searchMediaQO). Shows a restrained
 * "Proposer ce titre" fallback when nothing matches.
 */
export function MediaSearchPicker({
  onAdd,
  addedKeys,
  busyKey,
}: {
  onAdd: (item: MediaItem) => void;
  addedKeys: Set<string>;
  busyKey: string | null;
}) {
  const [q, setQ] = useState("");
  const debounced = useDebounce(q, 350);
  const query = useQuery(searchMediaQO(debounced));

  const results = useMemo(() => {
    const d = query.data;
    if (!d) return [];
    return [...d.anime, ...d.series, ...d.movies].slice(0, 30);
  }, [query.data]);

  const trimmed = debounced.trim();
  const showEmpty = trimmed.length >= 2 && !query.isFetching && results.length === 0;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un anime, une série, un film…"
          className="pl-9"
        />
      </div>

      {query.isFetching && (
        <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Recherche…
        </p>
      )}

      {results.length > 0 && (
        <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
          {results.map((item) => (
            <ResultRow
              key={item.key}
              item={item}
              onAdd={onAdd}
              added={addedKeys.has(item.key)}
              busy={busyKey === item.key}
            />
          ))}
        </div>
      )}

      {showEmpty && (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun titre trouvé pour « {trimmed} ».
          </p>
          <div className="mt-3 flex justify-center">
            <MissingTitleRequest defaultTitle={trimmed} />
          </div>
        </div>
      )}
    </div>
  );
}
