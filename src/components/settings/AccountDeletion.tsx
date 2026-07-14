import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, ShieldAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeletionRequest {
  id: string;
  status: "pending" | "processed" | "cancelled";
  reason: string | null;
  created_at: string;
  processed_at: string | null;
}

/**
 * Phase 26.1R — Interface utilisateur de demande de suppression de compte.
 * Écrit dans `public.account_deletion_requests` avec RLS stricte.
 * Aucune promesse de délai : traitement manuel, propriétaire.
 */
export function AccountDeletion() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [current, setCurrent] = useState<DeletionRequest | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("account_deletion_requests")
        .select("id, status, reason, created_at, processed_at")
        .eq("user_id", user.id)
        .in("status", ["pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (error) {
        // Non bloquant : on considère qu'il n'y a pas de demande active.
        setCurrent(null);
      } else {
        setCurrent((data as DeletionRequest | null) ?? null);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  async function submit() {
    if (!user?.id) return;
    setSubmitting(true);
    const trimmed = reason.trim().slice(0, 1000);
    const { data, error } = await supabase
      .from("account_deletion_requests")
      .insert({
        user_id: user.id,
        status: "pending",
        reason: trimmed.length > 0 ? trimmed : null,
      })
      .select("id, status, reason, created_at, processed_at")
      .single();
    setSubmitting(false);
    if (error) {
      // 23505 = doublon (index partiel unique sur status='pending')
      if ((error as { code?: string }).code === "23505") {
        toast.info(t.profile.deletionDuplicate);
      } else {
        toast.error(t.profile.deletionSubmitError);
      }
      return;
    }
    setCurrent(data as DeletionRequest);
    setReason("");
    toast.success(t.profile.deletionSubmitSuccess);
  }

  async function cancel() {
    if (!user?.id || !current) return;
    setCancelling(true);
    const { error } = await supabase
      .from("account_deletion_requests")
      .update({ status: "cancelled" })
      .eq("id", current.id)
      .eq("user_id", user.id)
      .eq("status", "pending");
    setCancelling(false);
    if (error) {
      toast.error(t.profile.deletionCancelError);
      return;
    }
    setCurrent(null);
    toast.success(t.profile.deletionCancelSuccess);
  }

  if (!user?.id) return null;

  return (
    <section
      id="suppression"
      className="scroll-mt-24 space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 backdrop-blur"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {t.profile.deletionTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{t.profile.deletionBody1}</p>
          <p className="text-sm text-muted-foreground">{t.profile.deletionBody2}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t.common.loading}
        </div>
      ) : current ? (
        <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="font-medium text-foreground">
                {t.profile.deletionPendingTitle}
              </p>
              <p className="text-muted-foreground">
                {t.profile.deletionPendingBodyPrefix}
                {new Date(current.created_at).toLocaleDateString(
                  locale === "en" ? "en-US" : "fr-FR",
                  { dateStyle: "long" },
                )}
                {t.profile.deletionPendingBodySuffix}
              </p>
              {current.reason ? (
                <p className="mt-2 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t.profile.deletionReasonLabel}
                  </span>{" "}
                  {current.reason}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={cancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="h-4 w-4" />
            )}
            {t.profile.deletionCancelBtn}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="deletion-reason"
              className="text-sm font-medium text-foreground"
            >
              {t.profile.deletionReasonInputLabel}
            </label>
            <Textarea
              id="deletion-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 1000))}
              placeholder={t.profile.deletionReasonPlaceholder}
              rows={3}
              className="bg-card/60"
            />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {t.profile.deletionRequestBtn}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.profile.deletionDialogTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t.profile.deletionDialogBody}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.profile.deletionDialogBack}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                >
                  {t.profile.deletionDialogConfirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </section>
  );
}
