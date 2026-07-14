// KAZEN — Personal statistics server function (Phase 19).
//
// PRIVATE by design: reads the CURRENT member's own list only, under RLS via
// requireSupabaseAuth. It returns an aggregated, compact DTO (never the raw
// list), so no private per-title data leaks beyond what stats need.
//
// PERFORMANCE: a single bounded query on list_items (indexed by user_id via
// RLS filter `auth.uid() = user_id`) joined to media_records. No N+1, no
// provider calls, no AI. Aggregation runs once server-side per request.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeStats, type PersonalStats, type StatsRow } from "./stats";
import type { MediaType } from "./media-types";

// Hard ceiling: personal lists are capped elsewhere (~5000). This guards
// against an unbounded scan while comfortably covering real accounts.
const MAX_ROWS = 6000;

export const getMyStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PersonalStats> => {
    const { data, error } = await context.supabase
      .from("list_items")
      .select(
        "status,favorite,rating,progress,started_at,completed_at,rewatch_count,created_at,media_records(media_type,genres,episodes_count,title,poster_url)",
      )
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);

    if (error) throw new Error(error.message);

    const rows: StatsRow[] = (data ?? []).map((r) => {
      const media = (r as { media_records: unknown }).media_records as
        | {
            media_type: string;
            genres: string[] | null;
            episodes_count: number | null;
            title: string;
            poster_url: string | null;
          }
        | null;
      return {
        status: r.status,
        favorite: r.favorite,
        rating: r.rating,
        progress: r.progress,
        started_at: r.started_at,
        completed_at: r.completed_at,
        rewatch_count: r.rewatch_count ?? 0,
        created_at: r.created_at,
        media: media
          ? {
              media_type: (["anime", "series", "movie"].includes(media.media_type)
                ? media.media_type
                : "series") as MediaType,
              genres: media.genres ?? [],
              episodes_count: media.episodes_count,
              title: media.title,
              poster_url: media.poster_url,
            }
          : null,
      };
    });

    return computeStats(rows);
  });
