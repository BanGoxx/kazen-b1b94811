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
    episodesCount: null,
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

export function useListMutations() {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertListItem);
  const removeFn = useServerFn(removeListItem);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-list"] });

  const upsert = useMutation({
    mutationFn: (vars: { item: MediaItem; patch: ListPatch }) =>
      upsertFn({ data: { media: snapshotFromItem(vars.item), patch: vars.patch } }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (mediaKey: string) => removeFn({ data: { mediaKey } }),
    onSuccess: invalidate,
  });

  return { upsert, remove };
}
