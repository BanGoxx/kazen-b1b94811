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
  | "playlist_item";

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
      "is_moderator",
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
