import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// KAZEN Phase 15 — AI assistant usage diagnostics (Owner-only).
// The underlying RPCs re-verify the Owner role server-side and raise
// "Forbidden" otherwise, so these thin wrappers add no separate check.

export interface AiAssistantStats {
  enabled: boolean;
  daily_user_limit: number;
  monthly_user_limit: number;
  global_daily_limit: number;
  global_monthly_limit: number;
  cache_enabled: boolean;
  cache_ttl_minutes: number;
  catalogue_version: number;
  cache_hit_daily_limit: number;
  questions_today: number;
  questions_month: number;
  success_today: number;
  failed_today: number;
  cached_today: number;
  cached_month: number;
  model_calls_month: number;
  active_cache_entries: number;
  expired_cache_entries: number;
  active_members_month: number;
  input_tokens_month: number;
  output_tokens_month: number;
}

export const getAiAssistantStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiAssistantStats> => {
    const { data, error } = await context.supabase.rpc("ai_assistant_admin_stats");
    if (error) throw new Error(error.message);
    return data as unknown as AiAssistantStats;
  });

export const setAiAssistantEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enabled: boolean }) => input)
  .handler(async ({ context, data }): Promise<AiAssistantStats> => {
    const { data: result, error } = await context.supabase.rpc(
      "ai_assistant_update_settings",
      { _patch: { enabled: data.enabled } },
    );
    if (error) throw new Error(error.message);
    return result as unknown as AiAssistantStats;
  });
