// KAZEN weekly recap — server functions (read-state only).
//
// These functions ONLY read and write the current member's recap read state.
// They never send email or generate content; recap content is composed
// client-side from the existing digest/notification data.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { currentWeekStart, type RecapState } from "./recap";

/** Returns whether the current ISO week's recap has been marked as read. */
export const getMyRecapState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecapState> => {
    const weekStart = currentWeekStart();
    const { data, error } = await context.supabase
      .from("weekly_recap_reads")
      .select("week_start")
      .eq("user_id", context.userId)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (error) return { weekStart, read: false };
    return { weekStart, read: !!data };
  });

/** Marks the current ISO week's recap as read (idempotent upsert). */
export const markRecapRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecapState> => {
    const weekStart = currentWeekStart();
    const { error } = await context.supabase
      .from("weekly_recap_reads")
      .upsert(
        { user_id: context.userId, week_start: weekStart } as never,
        { onConflict: "user_id,week_start", ignoreDuplicates: true },
      );
    if (error) return { weekStart, read: false };
    return { weekStart, read: true };
  });
