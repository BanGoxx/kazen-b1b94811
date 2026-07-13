import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// KAZEN Founder Console — Phase 1 server functions.
//
// Every privileged operation re-verifies the caller is the unique Owner via
// the SECURITY DEFINER `can_moderate_now` (Owner-only during beta). RLS on the
// badge tables enforces the same rule independently; these functions add the
// admin-only lookups (email <-> user id) the Owner console needs.

async function assertOwner(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}): Promise<void> {
  const { data, error } = await context.supabase.rpc("can_moderate_now", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// --- Private diagnostics for the Founder Console ------------------------------
export const founderDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { supabase } = context;

    const safeCount = async (
      table: string,
      apply?: (q: any) => any,
    ): Promise<number | null> => {
      try {
        let q = (supabase as any)
          .from(table)
          .select("*", { count: "exact", head: true });
        if (apply) q = apply(q);
        const { count, error } = await q;
        if (error) return null;
        return count ?? 0;
      } catch {
        return null;
      }
    };

    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [pendingReports, recentActions, pendingRequests, badges, assignments] =
      await Promise.all([
        safeCount("content_reports", (q) =>
          q.in("status", ["pending", "reviewing"]),
        ),
        safeCount("moderation_actions", (q) => q.gte("created_at", sinceIso)),
        safeCount("media_requests", (q) => q.eq("status", "pending")),
        safeCount("public_badges"),
        safeCount("user_public_badges"),
      ]);

    return {
      ownerRoleActive: true,
      betaModeration: "owner-only" as const,
      moderationAccessActive: true,
      pendingReports,
      recentActions,
      pendingRequests,
      badges,
      assignments,
    };
  });

// --- Owner assigns a public badge to a member by email -----------------------
export const assignBadgeByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { email: string; badgeId: string; isVisible?: boolean }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const email = data.email.trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("E-mail invalide.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find the target user id by email (paged scan; beta scale is small).
    let targetId: string | null = null;
    for (let page = 1; page <= 20 && !targetId; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error(error.message);
      const found = list.users.find(
        (u) => (u.email ?? "").toLowerCase() === email,
      );
      if (found) targetId = found.id;
      if (list.users.length < 200) break;
    }
    if (!targetId) throw new Error("Aucun membre trouvé avec cet e-mail.");

    const { error: insErr } = await supabaseAdmin
      .from("user_public_badges")
      .upsert(
        {
          user_id: targetId,
          badge_id: data.badgeId,
          assigned_by: context.userId,
          is_visible: data.isVisible ?? true,
        },
        { onConflict: "user_id,badge_id" },
      );
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });

// --- Owner lists current badge assignments (with member email) ---------------
export const listBadgeAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("user_public_badges")
      .select("id, user_id, badge_id, is_visible, assigned_at, public_badges(label)")
      .order("assigned_at", { ascending: false });
    if (error) throw new Error(error.message);

    const idToEmail = new Map<string, string>();
    const userIds = new Set((rows ?? []).map((r: any) => r.user_id));
    for (let page = 1; page <= 20 && idToEmail.size < userIds.size; page++) {
      const { data: list, error: listErr } =
        await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr) break;
      for (const u of list.users) {
        if (userIds.has(u.id)) idToEmail.set(u.id, u.email ?? "");
      }
      if (list.users.length < 200) break;
    }

    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      badgeId: r.badge_id as string,
      badgeLabel: (r.public_badges?.label as string) ?? "Badge",
      email: idToEmail.get(r.user_id) ?? "(membre inconnu)",
      isVisible: Boolean(r.is_visible),
      assignedAt: r.assigned_at as string,
    }));
  });

// --- Owner removes a badge assignment ----------------------------------------
export const removeBadgeAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { assignmentId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_public_badges")
      .delete()
      .eq("id", data.assignmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Owner toggles assignment visibility -------------------------------------
export const setAssignmentVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { assignmentId: string; isVisible: boolean }) => data)
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_public_badges")
      .update({ is_visible: data.isVisible })
      .eq("id", data.assignmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============================================================================
// Phase F — Founder Console Phase 2
//   F1 Operational health + F3 Product diagnostics.
//
// Both endpoints are Owner-only (assertOwner) and return AGGREGATE COUNTS ONLY.
// No member content, no recipient identifiers, no secrets, no provider keys.
// Every read is wrapped so a single missing table/permission degrades to a
// null metric instead of failing the whole panel.
// =============================================================================

type Metric = number | null;

function makeSafeCount(supabase: import("@supabase/supabase-js").SupabaseClient) {
  return async (table: string, apply?: (q: any) => any): Promise<Metric> => {
    try {
      let q = (supabase as any)
        .from(table)
        .select("*", { count: "exact", head: true });
      if (apply) q = apply(q);
      const { count, error } = await q;
      if (error) return null;
      return count ?? 0;
    } catch {
      return null;
    }
  };
}

// --- F1: operational health (aggregate-only, Owner) --------------------------
export const founderOperationalHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { supabase } = context;
    const count = makeSafeCount(supabase);

    const nowIso = new Date().toISOString();
    const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const weekAgoIso = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Provider cache freshness (AniList): count + stale (>24h) share.
    let cacheEntries: Metric = null;
    let cacheStale: Metric = null;
    try {
      const { count: total, error: e1 } = await (supabase as any)
        .from("anilist_cache")
        .select("*", { count: "exact", head: true });
      if (!e1) cacheEntries = total ?? 0;
      const { count: stale, error: e2 } = await (supabase as any)
        .from("anilist_cache")
        .select("*", { count: "exact", head: true })
        .lt("fetched_at", dayAgoIso);
      if (!e2) cacheStale = stale ?? 0;
    } catch {
      /* leave nulls */
    }

    const [
      importBatchesRecent,
      importFailedRecent,
      importItemsUnmatched,
      notifActive,
      notifExpiringSoon,
      emailFailedWeek,
      emailSentWeek,
      enrichmentPublished,
      enrichmentDrafts,
      enrichmentFlagged,
    ] = await Promise.all([
      count("import_batches", (q) => q.gte("created_at", weekAgoIso)),
      count("import_batches", (q) =>
        q.gte("created_at", weekAgoIso).in("status", ["failed", "error"]),
      ),
      count("import_items", (q) =>
        q.in("match_status", ["unmatched", "ambiguous", "failed"]),
      ),
      count("member_notifications", (q) =>
        q.is("dismissed_at", null).gt("expires_at", nowIso),
      ),
      count("member_notifications", (q) =>
        q
          .is("dismissed_at", null)
          .gt("expires_at", nowIso)
          .lt("expires_at", new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()),
      ),
      count("email_delivery_logs", (q) =>
        q.gte("created_at", weekAgoIso).eq("status", "failed"),
      ),
      count("email_delivery_logs", (q) =>
        q.gte("created_at", weekAgoIso).eq("status", "sent"),
      ),
      count("media_enrichments", (q) => q.eq("is_published", true)),
      count("media_enrichments", (q) => q.eq("is_published", false)),
      count("media_enrichments", (q) => q.not("qa_flags", "is", null)),
    ]);

    return {
      generatedAt: nowIso,
      provider: {
        cacheEntries,
        cacheStale,
        // Degraded when the majority of cache entries are stale.
        degraded:
          cacheEntries != null && cacheStale != null && cacheEntries > 0
            ? cacheStale / cacheEntries > 0.6
            : null,
      },
      imports: {
        recent: importBatchesRecent,
        failedRecent: importFailedRecent,
        unmatchedItems: importItemsUnmatched,
      },
      notifications: {
        active: notifActive,
        expiringSoon: notifExpiringSoon,
      },
      email: {
        // Aggregate only — no recipients, no message bodies.
        sentWeek: emailSentWeek,
        failedWeek: emailFailedWeek,
      },
      enrichment: {
        published: enrichmentPublished,
        drafts: enrichmentDrafts,
        flagged: enrichmentFlagged,
      },
    };
  });

// --- F3: product diagnostics (aggregate-only, no secrets, Owner) -------------
export const founderProductDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { supabase } = context;
    const count = makeSafeCount(supabase);

    const [
      missingSynopsis,
      weakImages,
      missingPlatforms,
      qualityFlagged,
      openRequests,
      publishedEnrichments,
    ] = await Promise.all([
      // Published fiches whose enrichment lacks a synopsis override.
      count("media_enrichments", (q) =>
        q.eq("is_published", true).is("synopsis_override", null),
      ),
      count("media_enrichments", (q) =>
        q.eq("is_published", true).is("poster_url_override", null),
      ),
      count("media_enrichments", (q) =>
        q.eq("is_published", true).is("external_links", null),
      ),
      // Editor-flagged quality issues to review.
      count("media_enrichments", (q) =>
        q.in("data_quality_status", ["incomplete", "needs_review", "broken"]),
      ),
      count("media_requests", (q) => q.eq("status", "pending")),
      count("media_enrichments", (q) => q.eq("is_published", true)),
    ]);

    // Simple derived checks — never expose raw rows or identifiers.
    const checks: { key: string; label: string; value: Metric; severity: "ok" | "watch" | "info" }[] =
      [
        {
          key: "missing_synopsis",
          label: "Fiches publiées sans synopsis enrichi",
          value: missingSynopsis,
          severity: (missingSynopsis ?? 0) > 0 ? "watch" : "ok",
        },
        {
          key: "weak_images",
          label: "Fiches publiées sans visuel enrichi",
          value: weakImages,
          severity: (weakImages ?? 0) > 0 ? "watch" : "ok",
        },
        {
          key: "missing_platforms",
          label: "Fiches publiées sans liens plateformes",
          value: missingPlatforms,
          severity: (missingPlatforms ?? 0) > 0 ? "info" : "ok",
        },
        {
          key: "quality_flagged",
          label: "Fiches marquées à surveiller",
          value: qualityFlagged,
          severity: (qualityFlagged ?? 0) > 0 ? "watch" : "ok",
        },
        {
          key: "open_requests",
          label: "Demandes de titres en attente",
          value: openRequests,
          severity: (openRequests ?? 0) > 0 ? "info" : "ok",
        },
      ];

    return {
      generatedAt: new Date().toISOString(),
      publishedEnrichments,
      checks,
    };
  });
