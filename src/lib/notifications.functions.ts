// KAZEN Internal Notification Center — Phase 1 server functions.
//
// Design principles honoured here:
//  - Additive & resilient: every handler tolerates missing data / provider
//    gaps and degrades to an empty, calm state rather than throwing.
//  - Server-controlled trust: notifications are NEVER inserted with the
//    member's own credentials. Reconciliation and mutations run through the
//    admin client after the middleware has authenticated the caller, so a
//    client cannot forge notifications (no INSERT/UPDATE grant to authenticated).
//  - DB-only sources in Phase 1: only event sources that are reliably present
//    in our own database are turned into notifications (upcoming releases from
//    the member's list, editorial articles exactly linked to saved titles, and
//    owner-authored system notices). Types without a reliable source
//    (new_episode, personalized_recommendation, shared_list_*) are intentionally
//    NOT generated yet — documented future work.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  isCategoryEnabled,
  type AppNotification,
  type NotificationPreferences,
} from "@/lib/notifications";
import { getRelevantArticlesForTitle } from "@/lib/news";
import { MEDIA_TYPE_LABELS, type MediaSource, type MediaType } from "@/lib/media-types";

const LIST_LIMIT = 60;
const RELEASE_WINDOW_DAYS = 14;
const MAX_CANDIDATE_ITEMS = 120;

interface DbNotificationRow {
  id: string;
  notification_type: AppNotification["type"];
  event_key: string;
  title: string;
  message: string;
  destination_url: string;
  media_source: string | null;
  media_external_id: string | null;
  article_slug: string | null;
  occurred_at: string;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
}

function mapRow(r: DbNotificationRow): AppNotification {
  return {
    id: r.id,
    type: r.notification_type,
    eventKey: r.event_key,
    title: r.title,
    message: r.message,
    destinationUrl: r.destination_url,
    mediaSource: r.media_source,
    mediaExternalId: r.media_external_id,
    articleSlug: r.article_slug,
    occurredAt: r.occurred_at,
    createdAt: r.created_at,
    readAt: r.read_at,
    dismissedAt: r.dismissed_at,
  };
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export const getMyNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationPreferences> => {
    const { data } = await context.supabase
      .from("member_notification_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    return {
      new_episode_enabled: data.new_episode_enabled,
      upcoming_release_enabled: data.upcoming_release_enabled,
      related_article_enabled: data.related_article_enabled,
      recommendation_enabled: data.recommendation_enabled,
      shared_list_enabled: data.shared_list_enabled,
      system_notice_enabled: data.system_notice_enabled,
    };
  });

export const updateMyNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Partial<NotificationPreferences>) => data)
  .handler(async ({ data, context }): Promise<NotificationPreferences> => {
    const allowed: (keyof NotificationPreferences)[] = [
      "new_episode_enabled",
      "upcoming_release_enabled",
      "related_article_enabled",
      "recommendation_enabled",
      "shared_list_enabled",
      "system_notice_enabled",
    ];
    const patch: Record<string, boolean> = {};
    for (const k of allowed) {
      if (typeof data[k] === "boolean") patch[k] = data[k] as boolean;
    }
    const { data: row, error } = await context.supabase
      .from("member_notification_preferences")
      .upsert(
        { user_id: context.userId, ...patch },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return {
      new_episode_enabled: row.new_episode_enabled,
      upcoming_release_enabled: row.upcoming_release_enabled,
      related_article_enabled: row.related_article_enabled,
      recommendation_enabled: row.recommendation_enabled,
      shared_list_enabled: row.shared_list_enabled,
      system_notice_enabled: row.system_notice_enabled,
    };
  });

// ---------------------------------------------------------------------------
// Read paths (RLS-scoped to the caller)
// ---------------------------------------------------------------------------

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppNotification[]> => {
    const nowIso = new Date().toISOString();
    const { data, error } = await context.supabase
      .from("member_notifications")
      .select(
        "id,notification_type,event_key,title,message,destination_url,media_source,media_external_id,article_slug,occurred_at,created_at,read_at,dismissed_at",
      )
      .eq("user_id", context.userId)
      .is("dismissed_at", null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("occurred_at", { ascending: false })
      .limit(LIST_LIMIT);
    if (error) return [];
    return (data as DbNotificationRow[]).map(mapRow);
  });

export const getMyUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ count: number }> => {
    const nowIso = new Date().toISOString();
    const { count, error } = await context.supabase
      .from("member_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("read_at", null)
      .is("dismissed_at", null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    if (error) return { count: 0 };
    return { count: count ?? 0 };
  });

// ---------------------------------------------------------------------------
// Mutations (server-controlled; ownership re-checked via admin client)
// ---------------------------------------------------------------------------

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("member_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("member_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null)
      .is("dismissed_at", null);
    return { ok: true };
  });

export const dismissNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("member_notifications")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Reconciliation — turn reliable DB signals into notifications (idempotent)
// ---------------------------------------------------------------------------

function daysUntil(dateStr: string, now: Date): number | null {
  // Require a full date (YYYY-MM-DD) to compute a meaningful countdown.
  if (!dateStr || dateStr.length < 8) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((t - start) / 86_400_000);
}

function releaseWording(mediaType: MediaType, days: number): { title: string; message: string } {
  const label = MEDIA_TYPE_LABELS[mediaType] ?? "Titre";
  const when =
    days <= 0 ? "sort aujourd'hui" : days === 1 ? "sort demain" : `sort dans ${days} jours`;
  return {
    title: `Sortie prochaine • ${label}`,
    message: `Un titre de votre liste ${when}.`,
  };
}

export const reconcileMyNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ ok: boolean; generated: number }> => {
      try {
        // 1) Preferences gate which categories may be generated.
        const { data: prefRow } = await context.supabase
          .from("member_notification_preferences")
          .select("*")
          .eq("user_id", context.userId)
          .maybeSingle();
        const prefs: NotificationPreferences = prefRow
          ? {
              new_episode_enabled: prefRow.new_episode_enabled,
              upcoming_release_enabled: prefRow.upcoming_release_enabled,
              related_article_enabled: prefRow.related_article_enabled,
              recommendation_enabled: prefRow.recommendation_enabled,
              shared_list_enabled: prefRow.shared_list_enabled,
              system_notice_enabled: prefRow.system_notice_enabled,
            }
          : { ...DEFAULT_NOTIFICATION_PREFERENCES };

        // 2) The member's list joined to media metadata (RLS-scoped).
        const { data: items } = await context.supabase
          .from("list_items")
          .select("media_key,status,favorite,media_records(*)")
          .eq("user_id", context.userId)
          .limit(MAX_CANDIDATE_ITEMS);

        const now = new Date();
        const rows: Record<string, unknown>[] = [];

        for (const item of (items ?? []) as Array<{
          media_key: string;
          status: string | null;
          favorite: boolean | null;
          media_records: {
            source: MediaSource;
            external_id: string;
            media_type: MediaType;
            title: string | null;
            release_date: string | null;
          } | null;
        }>) {
          const m = item.media_records;
          if (!m) continue;
          const dest = `/media/${m.source}/${m.external_id}`;

          // 2a) Upcoming release (within the next RELEASE_WINDOW_DAYS days).
          if (
            isCategoryEnabled(prefs, "upcoming_release") &&
            m.release_date
          ) {
            const days = daysUntil(m.release_date, now);
            if (days !== null && days >= 0 && days <= RELEASE_WINDOW_DAYS) {
              const w = releaseWording(m.media_type, days);
              const expires = new Date(m.release_date);
              expires.setDate(expires.getDate() + 2);
              rows.push({
                user_id: context.userId,
                notification_type: "upcoming_release",
                event_key: `release:${m.source}:${m.external_id}:${m.release_date}`,
                title: w.title,
                message: m.title ? `${m.title} ${days <= 0 ? "sort aujourd'hui" : days === 1 ? "sort demain" : `sort dans ${days} jours`}.` : w.message,
                destination_url: dest,
                media_source: m.source,
                media_external_id: m.external_id,
                occurred_at: now.toISOString(),
                expires_at: expires.toISOString(),
              });
            }
          }

          // 2b) Editorial article exactly linked to a saved title.
          if (isCategoryEnabled(prefs, "related_article")) {
            const relevant = getRelevantArticlesForTitle(m.source, m.external_id).filter(
              (r) => r.relevance === "exact",
            );
            for (const { article } of relevant.slice(0, 2)) {
              rows.push({
                user_id: context.userId,
                notification_type: "related_article",
                event_key: `article:${article.slug}:${item.media_key}`,
                title: "Article lié à votre liste",
                message: m.title
                  ? `Notre article « ${article.title} » concerne ${m.title}.`
                  : `Notre article « ${article.title} » pourrait vous intéresser.`,
                destination_url: `/actualites/${article.slug}`,
                media_source: m.source,
                media_external_id: m.external_id,
                article_slug: article.slug,
                occurred_at: now.toISOString(),
              });
            }
          }
        }

        if (rows.length === 0) return { ok: true, generated: 0 };

        // 3) Insert idempotently: never overwrite existing read/dismiss state.
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { error } = await supabaseAdmin
          .from("member_notifications")
          .upsert(rows as never, {
            onConflict: "user_id,event_key",
            ignoreDuplicates: true,
          });
        if (error) return { ok: false, generated: 0 };
        return { ok: true, generated: rows.length };
      } catch {
        // Resilient by design: a reconciliation failure must never break the UI.
        return { ok: false, generated: 0 };
      }
    },
  );

// ---------------------------------------------------------------------------
// Owner-only trusted system notice (Founder Console)
// ---------------------------------------------------------------------------

export const createSystemNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { title: string; message: string; destinationUrl?: string }) => data,
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: id, error } = await context.supabase.rpc("create_system_notice", {
      _title: data.title,
      _message: data.message,
      _destination_url: data.destinationUrl ?? "/notifications",
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });
