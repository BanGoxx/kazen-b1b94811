import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// KAZEN Phase 17 — Beta feedback.
// Authenticated members submit bounded, rate-limited feedback. The Owner
// reviews everything from the Founder console. RLS + a DB rate-limit trigger
// enforce every rule independently; these functions add server-side identity
// and input clamping.

export type BetaFeedbackCategory =
  | "bug"
  | "suggestion"
  | "missing_title"
  | "incorrect_info"
  | "usability"
  | "other";

export type BetaFeedbackStatus =
  | "received"
  | "reviewing"
  | "resolved"
  | "dismissed";

export const BETA_FEEDBACK_CATEGORY_LABELS: Record<BetaFeedbackCategory, string> = {
  bug: "Bug",
  suggestion: "Suggestion",
  missing_title: "Titre manquant",
  incorrect_info: "Information incorrecte",
  usability: "Ergonomie",
  other: "Autre",
};

export const BETA_FEEDBACK_STATUS_LABELS: Record<BetaFeedbackStatus, string> = {
  received: "Reçu",
  reviewing: "En cours",
  resolved: "Résolu",
  dismissed: "Écarté",
};

export interface BetaFeedback {
  id: string;
  userId: string;
  category: BetaFeedbackCategory;
  title: string;
  body: string;
  status: BetaFeedbackStatus;
  createdAt: string;
}

const CATEGORIES: BetaFeedbackCategory[] = [
  "bug",
  "suggestion",
  "missing_title",
  "incorrect_info",
  "usability",
  "other",
];

/** Strips any raw HTML/control characters and clamps length. */
function sanitize(input: string, max: number): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

export const submitBetaFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { category: string; title: string; body: string }) => data,
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const category = (
      CATEGORIES.includes(data.category as BetaFeedbackCategory)
        ? data.category
        : "other"
    ) as BetaFeedbackCategory;
    const title = sanitize(data.title ?? "", 120);
    const body = sanitize(data.body ?? "", 2000);
    if (title.length < 3) throw new Error("Le titre est trop court.");
    if (body.length < 5) throw new Error("Le message est trop court.");

    const { error } = await context.supabase.from("beta_feedback").insert({
      user_id: context.userId,
      category,
      title,
      body,
    });
    if (error) {
      if (/rate limit/i.test(error.message)) {
        throw new Error(
          "Trop de retours envoyés récemment. Réessayez dans un moment.",
        );
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

/** Owner-only: list all beta feedback, newest first. */
export const listBetaFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BetaFeedback[]> => {
    const { data: allowed, error: roleErr } = await context.supabase.rpc(
      "can_moderate_now",
      { _user_id: context.userId },
    );
    if (roleErr) throw new Error(roleErr.message);
    if (!allowed) throw new Error("Forbidden");

    const { data, error } = await context.supabase
      .from("beta_feedback")
      .select("id, user_id, category, title, body, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      category: r.category as BetaFeedbackCategory,
      title: r.title as string,
      body: r.body as string,
      status: r.status as BetaFeedbackStatus,
      createdAt: r.created_at as string,
    }));
  });

/** Owner-only: update the review status of a feedback entry. */
export const setBetaFeedbackStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: BetaFeedbackStatus }) => data)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: allowed, error: roleErr } = await context.supabase.rpc(
      "can_moderate_now",
      { _user_id: context.userId },
    );
    if (roleErr) throw new Error(roleErr.message);
    if (!allowed) throw new Error("Forbidden");

    const { error } = await context.supabase
      .from("beta_feedback")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
