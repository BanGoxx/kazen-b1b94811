import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  upcomingAnimeQO,
  upcomingMoviesQO,
  onAirSeriesQO,
  trendingAnimeQO,
  trendingMoviesQO,
  trendingSeriesQO,
} from "./queries";
import { useCandidatePool, useTasteProfile } from "./use-recommendations";
import { useMyList } from "./use-list";
import { getMyEmailPreferences, type EmailPreferences } from "./email-prefs.functions";
import { useAuth } from "./auth";
import { rankForYouAnimeFirst, rankFreshForYou } from "./recommend";
import { getArticlesForTitle, getRecentArticles, type NewsArticle } from "./news";
import type { MediaItem, MediaSource } from "./media-types";
import {
  buildGeneralDigest,
  buildPersonalizedDigest,
  type DigestModel,
} from "./digest";

/** Loads the member's saved email preferences (defaults when none). */
export function useEmailPreferences() {
  const { user } = useAuth();
  return useQuery<EmailPreferences>({
    queryKey: ["email-preferences"],
    queryFn: () => getMyEmailPreferences(),
    enabled: !!user,
    staleTime: 60_000,
  });
}

interface DigestState {
  model: DigestModel | null;
  isLoading: boolean;
  /** True when a provider clearly failed AND we have nothing to show. */
  providerFailed: boolean;
}

/**
 * Builds the GENERAL digest preview from already-cached discovery data.
 * Provider-resilient: any empty/failed source simply drops its section.
 */
export function useGeneralDigest(prefs?: EmailPreferences): DigestState {
  const ua = useQuery(upcomingAnimeQO);
  const um = useQuery(upcomingMoviesQO);
  const os = useQuery(onAirSeriesQO);
  const ta = useQuery(trendingAnimeQO);
  const tm = useQuery(trendingMoviesQO);
  const ts = useQuery(trendingSeriesQO);

  const isLoading = ua.isLoading || um.isLoading || ta.isLoading;
  const providerFailed =
    !isLoading && ua.isError && um.isError && os.isError && ta.isError;

  const model = useMemo<DigestModel | null>(() => {
    if (isLoading) return null;
    const trending = dedupe([...(ta.data ?? []), ...(tm.data ?? []), ...(ts.data ?? [])]);
    const articles = getRecentArticles(6);
    const m = buildGeneralDigest({
      upcomingAnime: ua.data ?? [],
      upcomingMovies: um.data ?? [],
      onAirSeries: os.data ?? [],
      trending,
      articles,
      prefs,
    });
    return m;
  }, [isLoading, ua.data, um.data, os.data, ta.data, tm.data, ts.data, prefs]);

  return { model, isLoading, providerFailed };
}

/**
 * Builds the PERSONALIZED "Pour vous" digest preview from the member's own
 * list signals + cached discovery pool. Uses only the current member's data.
 */
export function usePersonalizedDigest(prefs?: EmailPreferences): DigestState {
  const { pool, isLoading } = useCandidatePool();
  const profile = useTasteProfile();
  const { entries } = useMyList();

  const providerFailed = !isLoading && pool.length === 0;

  const model = useMemo<DigestModel | null>(() => {
    if (isLoading) return null;

    const recommendations = rankForYouAnimeFirst(pool, profile, { limit: 8 }).map((s) => ({
      item: s.item,
      reasonGenres: s.reasonGenres,
    }));
    const freshForYou = rankFreshForYou(pool, profile, 8);

    const inProgress = entries
      .filter((e) => e.status === "en_cours" && e.item)
      .map((e) => e.item as MediaItem);
    const planned = entries
      .filter((e) => e.status === "a_voir" && e.item)
      .map((e) => e.item as MediaItem);

    // Related articles: derived from the member's own followed titles only.
    const seenArticles = new Set<string>();
    const relatedArticles: NewsArticle[] = [];
    for (const e of entries) {
      if (!e.item) continue;
      for (const a of getArticlesForTitle(e.item.source as MediaSource, e.item.externalId)) {
        if (a.externalUrl || seenArticles.has(a.slug)) continue;
        seenArticles.add(a.slug);
        relatedArticles.push(a);
      }
    }

    return buildPersonalizedDigest({
      recommendations,
      freshForYou,
      inProgress,
      planned,
      relatedArticles,
      profile,
      prefs,
    });
  }, [isLoading, pool, profile, entries, prefs]);

  return { model, isLoading, providerFailed };
}

function dedupe(items: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  const out: MediaItem[] = [];
  for (const it of items) {
    if (!it || !it.key || seen.has(it.key)) continue;
    seen.add(it.key);
    out.push(it);
  }
  return out;
}
