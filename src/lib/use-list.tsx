import { useMemo } from "react";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getMyList,
  removeListItem,
  snapshotFromItem,
  upsertListItem,
  type ListPatch,
} from "./list.functions";
import { useAuth } from "./auth";
import type {
  MediaItem,
  Platform,
  PriorityLevel,
  WatchStatus,
  MediaSource,
  MediaType,
} from "./media-types";

export const myListQO = queryOptions({
  queryKey: ["my-list"],
  queryFn: () => getMyList(),
  staleTime: 1000 * 30,
});

export type ListRow = Awaited<ReturnType<typeof getMyList>>[number];

export interface ListEntry {
  mediaKey: string;
  status: WatchStatus | null;
  favorite: boolean;
  priority: PriorityLevel;
  rating: number | null;
  notes: string;
  tags: string[];
  progress: number | null;
  startedAt: string | null;
  completedAt: string | null;
  rewatchCount: number;
  isRewatching: boolean;
  updatedAt: string;
  item: MediaItem | null;
}

function rowToMediaItem(rec: NonNullable<ListRow["media_records"]>): MediaItem {
  return {
    key: rec.media_key,
    source: rec.source as MediaSource,
    externalId: rec.external_id,
    mediaType: rec.media_type as MediaType,
    title: rec.title,
    titleOriginal: rec.title_original,
    synopsis: null,
    posterUrl: rec.poster_url,
    backdropUrl: rec.backdrop_url,
    genres: rec.genres ?? [],
    score: rec.score,
    status: null,
    releaseDate: rec.release_date,
    nextEpisode: null,
    episodesCount: rec.episodes_count ?? null,
    seasonsCount: null,
    runtime: null,
    platforms: (rec.platforms as Platform[] | null) ?? [],
  };
}

export function useMyList() {
  const { user, ready } = useAuth();
  const query = useQuery({ ...myListQO, enabled: ready && Boolean(user) });
  const entries = useMemo<ListEntry[]>(() => {
    return (query.data ?? []).map((row) => ({
      mediaKey: row.media_key,
      status: row.status,
      favorite: row.favorite,
      priority: row.priority,
      rating: row.rating,
      notes: row.notes,
      tags: row.tags ?? [],
      progress: row.progress,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      rewatchCount: row.rewatch_count,
      isRewatching: row.is_rewatching,
      updatedAt: row.updated_at,
      item: row.media_records ? rowToMediaItem(row.media_records) : null,
    }));
  }, [query.data]);
  return { ...query, entries };
}

export function useUserEntry(mediaKey: string): ListEntry | null {
  const { entries } = useMyList();
  return entries.find((e) => e.mediaKey === mediaKey) ?? null;
}

type UpsertVars = { item: MediaItem; patch: ListPatch };

// Build the media_records snapshot the list query embeds, so an optimistic row
// renders identically to a server row (poster, title, etc.).
function optimisticMediaRecord(item: MediaItem): NonNullable<ListRow["media_records"]> {
  const now = new Date().toISOString();
  return {
    media_key: item.key,
    source: item.source,
    external_id: item.externalId,
    media_type: item.mediaType,
    title: item.title,
    title_original: item.titleOriginal,
    poster_url: item.posterUrl,
    backdrop_url: item.backdropUrl,
    release_date: item.releaseDate,
    genres: item.genres ?? [],
    platforms: item.platforms as never,
    score: item.score,
    episodes_count: item.episodesCount ?? null,
    created_at: now,
    updated_at: now,
  } as NonNullable<ListRow["media_records"]>;
}

// Merge a patch onto an existing row (or a fresh row) respecting explicit nulls
// so "clear rating" / "clear status" work correctly.
function applyPatch(prev: ListRow | undefined, vars: UpsertVars): ListRow {
  const { item, patch } = vars;
  const base: ListRow =
    prev ??
    ({
      media_key: item.key,
      status: null,
      favorite: false,
      priority: "normale",
      rating: null,
      notes: "",
      tags: [],
      progress: null,
      started_at: null,
      completed_at: null,
      rewatch_count: 0,
      is_rewatching: false,
      updated_at: new Date().toISOString(),
      media_records: optimisticMediaRecord(item),
    } as unknown as ListRow);
  return {
    ...base,
    status: "status" in patch ? patch.status ?? null : base.status,
    favorite: "favorite" in patch ? patch.favorite ?? false : base.favorite,
    priority: "priority" in patch ? patch.priority ?? "normale" : base.priority,
    rating: "rating" in patch ? patch.rating ?? null : base.rating,
    notes: "notes" in patch ? patch.notes ?? "" : base.notes,
    tags: "tags" in patch ? patch.tags ?? [] : base.tags,
    progress: "progress" in patch ? patch.progress ?? null : base.progress,
    started_at: "started_at" in patch ? patch.started_at ?? null : base.started_at,
    completed_at: "completed_at" in patch ? patch.completed_at ?? null : base.completed_at,
    rewatch_count: "rewatch_count" in patch ? patch.rewatch_count ?? 0 : base.rewatch_count,
    is_rewatching: "is_rewatching" in patch ? patch.is_rewatching ?? false : base.is_rewatching,
    updated_at: new Date().toISOString(),
    media_records: base.media_records ?? optimisticMediaRecord(item),
  };
}

export function useListMutations() {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertListItem);
  const removeFn = useServerFn(removeListItem);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-list"] });
    // Personal statistics derive from the same tracking data.
    qc.invalidateQueries({ queryKey: ["my-stats"] });
  };

  const upsert = useMutation({
    mutationFn: (vars: UpsertVars) =>
      upsertFn({ data: { media: snapshotFromItem(vars.item), patch: vars.patch } }),
    // Optimistic: reflect the change instantly, roll back on failure.
    onMutate: async (vars: UpsertVars) => {
      await qc.cancelQueries({ queryKey: ["my-list"] });
      const previous = qc.getQueryData<ListRow[]>(["my-list"]);
      qc.setQueryData<ListRow[]>(["my-list"], (old) => {
        const rows = old ?? [];
        const idx = rows.findIndex((r) => r.media_key === vars.item.key);
        const updated = applyPatch(idx >= 0 ? rows[idx] : undefined, vars);
        if (idx >= 0) {
          const next = rows.slice();
          next[idx] = updated;
          return next;
        }
        return [updated, ...rows];
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["my-list"], ctx.previous);
      toast.error("Impossible d'enregistrer. Réessayez.");
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (mediaKey: string) => removeFn({ data: { mediaKey } }),
    onMutate: async (mediaKey: string) => {
      await qc.cancelQueries({ queryKey: ["my-list"] });
      const previous = qc.getQueryData<ListRow[]>(["my-list"]);
      qc.setQueryData<ListRow[]>(["my-list"], (old) =>
        (old ?? []).filter((r) => r.media_key !== mediaKey),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["my-list"], ctx.previous);
      toast.error("Impossible de retirer ce titre. Réessayez.");
    },
    onSuccess: () => toast.success("Retiré de votre liste"),
    onSettled: invalidate,
  });

  return { upsert, remove };
}

