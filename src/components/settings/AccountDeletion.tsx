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
        toast.info("Une demande est déjà en cours pour ton compte.");
      } else {
        toast.error("Impossible d'enregistrer la demande. Réessaie plus tard.");
      }
      return;
    }
    setCurrent(data as DeletionRequest);
    setReason("");
    toast.success("Ta demande a été enregistrée. Nous te recontacterons.");
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
      toast.error("Impossible d'annuler la demande.");
      return;
    }
    setCurrent(null);
    toast.success("Demande annulée.");
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
            Suppression du compte
          </h2>
          <p className="text-sm text-muted-foreground">
            Tu peux nous demander la suppression de ton compte KAZEN. Il s'agit d'une
            demande : le traitement est manuel et n'est pas immédiat. Certaines
            données peuvent être conservées ou anonymisées lorsque la loi ou nos
            obligations techniques l'exigent (registres de modération, journaux
            de sécurité, sauvegardes en rotation).
          </p>
          <p className="text-sm text-muted-foreground">
            Aucun délai n'est garanti tant que nos conditions juridiques ne sont
            pas finalisées. Nous te confirmerons la suppression effective par
            e-mail lorsqu'elle sera traitée.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : current ? (
        <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="font-medium text-foreground">
                Demande en cours de traitement
              </p>
              <p className="text-muted-foreground">
                Enregistrée le{" "}
                {new Date(current.created_at).toLocaleDateString("fr-FR", {
                  dateStyle: "long",
                })}
                . Tant qu'elle n'est pas traitée, tu peux l'annuler.
              </p>
              {current.reason ? (
                <p className="mt-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Motif :</span>{" "}
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
            Annuler ma demande
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="deletion-reason"
              className="text-sm font-medium text-foreground"
            >
              Motif (facultatif)
            </label>
            <Textarea
              id="deletion-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 1000))}
              placeholder="Aide-nous à comprendre — ce champ est optionnel."
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
                Demander la suppression de mon compte
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la demande ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Nous allons enregistrer une demande de suppression pour ton
                  compte. Aucun compte n'est supprimé immédiatement : nous te
                  recontacterons pour traiter ta demande manuellement. Tu
                  pourras l'annuler tant qu'elle est en cours.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Retour</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                >
                  Enregistrer ma demande
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </section>
  );
}
