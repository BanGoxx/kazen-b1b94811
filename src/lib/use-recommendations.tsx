import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  trendingAnimeQO,
  popularAnimeQO,
  upcomingAnimeQO,
  seasonalAnimeQO,
  trendingMoviesQO,
  popularMoviesQO,
  upcomingMoviesQO,
  animatedMoviesQO,
  trendingSeriesQO,
  popularSeriesQO,
  onAirSeriesQO,
} from "./queries";
import { useMyList } from "./use-list";
import { getMyProfile } from "./list.functions";
import { useAuth } from "./auth";
import { buildTasteProfile, normalizePool, type TasteProfile } from "./recommend";
import {
  getMyRecoFeedback,
  addRecoFeedback,
  removeRecoFeedback,
  type RecoFeedbackEntry,
} from "./recommend.functions";
import type { MediaItem } from "./media-types";



/**
 * Aggregates the already-cached discovery pools into a single deduped candidate
 * list and derives the user's taste profile. Reuses existing queries only — no
 * new API pressure, cache/rate-limit safeguards stay intact.
 */
export function useCandidatePool() {
  const ta = useQuery(trendingAnimeQO);
  const pa = useQuery(popularAnimeQO);
  const ua = useQuery(upcomingAnimeQO);
  const sa = useQuery(seasonalAnimeQO());
  const tm = useQuery(trendingMoviesQO);
  const pm = useQuery(popularMoviesQO);
  const um = useQuery(upcomingMoviesQO);
  const am = useQuery(animatedMoviesQO);
  const ts = useQuery(trendingSeriesQO);
  const ps = useQuery(popularSeriesQO);
  const os = useQuery(onAirSeriesQO);

  const isLoading =
    ta.isLoading || tm.isLoading || ts.isLoading || pa.isLoading;

  const pool = useMemo<MediaItem[]>(
    () =>
      normalizePool([
        ta.data ?? [],
        pa.data ?? [],
        ua.data ?? [],
        sa.data?.items ?? [],
        tm.data ?? [],
        pm.data ?? [],
        um.data ?? [],
        am.data ?? [],
        ts.data ?? [],
        ps.data ?? [],
        os.data ?? [],
      ]),
    [
      ta.data, pa.data, ua.data, sa.data, tm.data, pm.data,
      um.data, am.data, ts.data, ps.data, os.data,
    ],
  );

  return { pool, isLoading };
}

export function useTasteProfile(): TasteProfile {
  const { entries } = useMyList();
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", "prefs"],
    queryFn: () => getMyProfile(),
    enabled: !!user,
    staleTime: 60_000,
  });
  return useMemo(
    () =>
      buildTasteProfile(entries, {
        genres: (profile?.preferred_genres as string[] | undefined) ?? undefined,
        types: (profile?.preferred_types as string[] | undefined) ?? undefined,
      }),
    [entries, profile?.preferred_genres, profile?.preferred_types],
  );
}

const RECO_FEEDBACK_KEY = ["reco-feedback"] as const;

/**
 * Manages the member's dismissed recommendations. Exposes a Set of hidden
 * media keys (to filter rails) plus hide/restore mutations. Guests get an
 * empty, no-op surface so the rails degrade gracefully.
 */
export function useRecoFeedback() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const getFn = useServerFn(getMyRecoFeedback);
  const addFn = useServerFn(addRecoFeedback);
  const removeFn = useServerFn(removeRecoFeedback);

  const query = useQuery<RecoFeedbackEntry[]>({
    queryKey: [...RECO_FEEDBACK_KEY, user?.id],
    queryFn: () => getFn(),
    enabled: !!user,
    staleTime: 300_000,
  });

  const hiddenKeys = useMemo(
    () => new Set((query.data ?? []).map((f) => f.mediaKey)),
    [query.data],
  );

  const hide = useMutation({
    mutationFn: (mediaKey: string) => addFn({ data: { mediaKey, action: "not_interested" } }),
    onMutate: async (mediaKey) => {
      const key = [...RECO_FEEDBACK_KEY, user?.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<RecoFeedbackEntry[]>(key) ?? [];
      qc.setQueryData<RecoFeedbackEntry[]>(key, [
        ...prev.filter((f) => f.mediaKey !== mediaKey),
        { mediaKey, action: "not_interested" },
      ]);
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
    },
  });

  const restore = useMutation({
    mutationFn: (mediaKey: string) => removeFn({ data: { mediaKey } }),
    onMutate: async (mediaKey) => {
      const key = [...RECO_FEEDBACK_KEY, user?.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<RecoFeedbackEntry[]>(key) ?? [];
      qc.setQueryData<RecoFeedbackEntry[]>(
        key,
        prev.filter((f) => f.mediaKey !== mediaKey),
      );
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
    },
  });

  const hideItem = useCallback((mediaKey: string) => hide.mutate(mediaKey), [hide]);

  return {
    hiddenKeys,
    canHide: !!user,
    hideItem,
    restore: (mediaKey: string) => restore.mutate(mediaKey),
    entries: query.data ?? [],
  };
}


