import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Phase 1 — Email Preferences + Digest Foundation.
// This module only reads/writes the current member's own email preferences.
// It NEVER sends emails, schedules jobs, or touches an email provider.

export type DigestFrequency = "weekly" | "monthly" | "never";

export interface EmailPreferences {
  receive_general_digest: boolean;
  receive_personalized_digest: boolean;
  digest_frequency: DigestFrequency;
  preferred_content_types: string[];
  preferred_genres: string[] | null;
  preferred_platforms: string[] | null;
  include_upcoming: boolean;
  include_articles: boolean;
  include_recommendations: boolean;
  last_digest_preview_at: string | null;
  consent_updated_at: string | null;
}

/** Safe, privacy-first defaults: no email unless the member explicitly opts in. */
export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  receive_general_digest: false,
  receive_personalized_digest: false,
  digest_frequency: "weekly",
  preferred_content_types: ["anime", "films", "series", "articles"],
  preferred_genres: null,
  preferred_platforms: null,
  include_upcoming: true,
  include_articles: true,
  include_recommendations: true,
  last_digest_preview_at: null,
  consent_updated_at: null,
};

export const getMyEmailPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailPreferences> => {
    const { data, error } = await context.supabase
      .from("member_email_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return DEFAULT_EMAIL_PREFERENCES;
    return {
      receive_general_digest: data.receive_general_digest,
      receive_personalized_digest: data.receive_personalized_digest,
      digest_frequency: data.digest_frequency as DigestFrequency,
      preferred_content_types: data.preferred_content_types ?? [],
      preferred_genres: data.preferred_genres,
      preferred_platforms: data.preferred_platforms,
      include_upcoming: data.include_upcoming,
      include_articles: data.include_articles,
      include_recommendations: data.include_recommendations,
      last_digest_preview_at: data.last_digest_preview_at,
      consent_updated_at: data.consent_updated_at,
    };
  });

export interface EmailPreferencesPatch {
  receive_general_digest?: boolean;
  receive_personalized_digest?: boolean;
  digest_frequency?: DigestFrequency;
  preferred_content_types?: string[];
  preferred_genres?: string[] | null;
  preferred_platforms?: string[] | null;
  include_upcoming?: boolean;
  include_articles?: boolean;
  include_recommendations?: boolean;
}

export const updateMyEmailPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: EmailPreferencesPatch) => data)
  .handler(async ({ data, context }) => {
    // Any change that touches consent (the two opt-in switches or frequency)
    // is timestamped so consent history stays auditable.
    const touchesConsent =
      data.receive_general_digest !== undefined ||
      data.receive_personalized_digest !== undefined ||
      data.digest_frequency !== undefined;

    const patch: Record<string, unknown> = { ...data, user_id: context.userId };
    if (touchesConsent) patch.consent_updated_at = new Date().toISOString();

    const { error } = await context.supabase
      .from("member_email_preferences")
      .upsert(patch, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Records that the member generated a digest preview (no email is sent). */
export const markDigestPreviewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("member_email_preferences")
      .upsert(
        { user_id: context.userId, last_digest_preview_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
