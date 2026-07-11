import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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

