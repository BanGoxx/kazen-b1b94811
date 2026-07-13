import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Phase C — Moderation spine (minimal, RLS-safe server helpers).
// All privileged logic lives in SECURITY DEFINER database functions that
// verify auth.uid() and role internally, so these server functions are thin
// wrappers. RLS + the DB functions are the real enforcement layer.

export type ModerationTargetType =
  | "review"
  | "reply"
  | "playlist"
  | "playlist_item"
  | "playlist_review";

export type ModerationActionType =
  | "hide"
  | "unhide"
  | "soft_delete"
  | "restore"
  | "lock"
  | "unlock"
  | "warn"
  | "timeout"
  | "dismiss_report";

export type ReportStatus =
  | "pending"
  | "reviewing"
  | "dismissed"
  | "action_taken";

// --- Member-facing: submit a structured report -------------------------------
export const submitContentReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      targetType: ModerationTargetType;
      targetId: string;
      reason: string;
      details?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc(
      "submit_content_report",
      {
        _target_type: data.targetType,
        _target_id: data.targetId,
        _reason: data.reason,
        _details: data.details ?? "",
      },
    );
    if (error) throw new Error(error.message);
    return { id };
  });

// --- Elevated roles: list reports (RLS restricts rows to moderators+) ---------
export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { status?: ReportStatus } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    // Only moderators/admins/owner are allowed to moderate at all.
    const { data: isMod, error: roleErr } = await context.supabase.rpc(
      "can_moderate_now",
      { _user_id: context.userId },
    );
    if (roleErr) throw new Error(roleErr.message);
    if (!isMod) throw new Error("Forbidden");

    let query = context.supabase
      .from("content_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (data.status) query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// --- Elevated roles: apply a moderation action + audit -----------------------
export const moderateContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      targetType: ModerationTargetType;
      targetId: string;
      action: ModerationActionType;
      reason?: string;
      note?: string;
      reportId?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("moderate_content", {
      _target_type: data.targetType,
      _target_id: data.targetId,
      _action: data.action,
      _reason: data.reason ?? "",
      _note: data.note ?? "",
      _report_id: data.reportId ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Elevated roles: resolve a report without a content action ---------------
export const resolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { reportId: string; status: ReportStatus; note?: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("resolve_report", {
      _report_id: data.reportId,
      _status: data.status,
      _note: data.note ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Elevated roles: is the current user a moderator+? ------------------------
export const myModeratorStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("can_moderate_now", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { isModerator: Boolean(data) };
  });

type TargetSnapshot = {
  exists: boolean;
  preview: string;
  ownerId: string | null;
  ownerName: string | null;
  hidden: boolean;
  softDeleted: boolean;
  link: string | null;
};

async function loadTargetSnapshot(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  targetType: string,
  targetId: string,
): Promise<TargetSnapshot> {
  const empty: TargetSnapshot = {
    exists: false,
    preview: "(contenu introuvable)",
    ownerId: null,
    ownerName: null,
    hidden: false,
    softDeleted: false,
    link: null,
  };
  try {
    if (targetType === "review") {
      const { data } = await supabase
        .from("fiche_reviews")
        .select("user_id, body, media_source, external_id, hidden_at, deleted_at")
        .eq("id", targetId)
        .maybeSingle();
      if (!data) return empty;
      return {
        exists: true,
        preview: (data.body ?? "").slice(0, 240),
        ownerId: data.user_id,
        ownerName: null,
        hidden: Boolean(data.hidden_at),
        softDeleted: Boolean(data.deleted_at),
        link: `/media/${data.media_source}/${data.external_id}`,
      };
    }
    if (targetType === "reply") {
      const { data } = await supabase
        .from("review_replies")
        .select("user_id, body, hidden_at, deleted_at")
        .eq("id", targetId)
        .maybeSingle();
      if (!data) return empty;
      return {
        exists: true,
        preview: (data.body ?? "").slice(0, 240),
        ownerId: data.user_id,
        ownerName: null,
        hidden: Boolean(data.hidden_at),
        softDeleted: Boolean(data.deleted_at),
        link: null,
      };
    }
    if (targetType === "playlist") {
      const { data } = await supabase
        .from("playlists")
        .select("owner_id, title, description, hidden_at, deleted_at")
        .eq("id", targetId)
        .maybeSingle();
      if (!data) return empty;
      return {
        exists: true,
        preview: [data.title, data.description].filter(Boolean).join(" — ").slice(0, 240),
        ownerId: data.owner_id,
        ownerName: null,
        hidden: Boolean(data.hidden_at),
        softDeleted: Boolean(data.deleted_at),
        link: `/playlist/${targetId}`,
      };
    }
    if (targetType === "playlist_item") {
      const { data } = await supabase
        .from("playlist_items")
        .select("playlist_id, title, hidden_at, deleted_at")
        .eq("id", targetId)
        .maybeSingle();
      if (!data) return empty;
      return {
        exists: true,
        preview: (data.title ?? "(élément de liste)").slice(0, 240),
        ownerId: null,
        ownerName: null,
        hidden: Boolean(data.hidden_at),
        softDeleted: Boolean(data.deleted_at),
        link: data.playlist_id ? `/playlist/${data.playlist_id}` : null,
      };
    }
  } catch {
    return empty;
  }
  return empty;
}

// --- Elevated roles: enriched moderation queue -------------------------------
export const moderationQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { status?: ReportStatus } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const { data: isMod, error: roleErr } = await context.supabase.rpc(
      "can_moderate_now",
      { _user_id: context.userId },
    );
    if (roleErr) throw new Error(roleErr.message);
    if (!isMod) throw new Error("Forbidden");

    let query = context.supabase
      .from("content_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (data.status) query = query.eq("status", data.status);
    else query = query.in("status", ["pending", "reviewing"]);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const reports = rows ?? [];
    const enriched = await Promise.all(
      reports.map(async (r) => {
        const target = await loadTargetSnapshot(
          context.supabase,
          r.target_type,
          r.target_id,
        );
        let reporterName: string | null = null;
        if (r.reporter_id) {
          const { data: prof } = await context.supabase
            .from("profiles")
            .select("display_name")
            .eq("id", r.reporter_id)
            .maybeSingle();
          reporterName = prof?.display_name ?? null;
        }
        return { ...r, target, reporterName };
      }),
    );
    return enriched;
  });

// --- Elevated roles: recent moderation actions for a target ------------------
export const targetModerationHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { targetType: ModerationTargetType; targetId: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: isMod, error: roleErr } = await context.supabase.rpc(
      "can_moderate_now",
      { _user_id: context.userId },
    );
    if (roleErr) throw new Error(roleErr.message);
    if (!isMod) throw new Error("Forbidden");

    const { data: rows, error } = await context.supabase
      .from("moderation_actions")
      .select("id, action, reason, note, created_at, actor_id")
      .eq("target_type", data.targetType)
      .eq("target_id", data.targetId)
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
