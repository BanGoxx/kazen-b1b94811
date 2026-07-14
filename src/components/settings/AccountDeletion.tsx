import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelMyDeletionRequest,
  createMyDeletionRequest,
  getMyPendingDeletionRequest,
} from "@/lib/account-deletion";

// KAZEN — Phase 26.1 (C5). Membre-facing UI for RGPD art. 17 requests.
// The mechanism is a documented request flow rather than an immediate
// destructive delete: this guarantees UGC anonymization strategy remains
// under Owner control and no irreversible action ships without confirmation.

export function AccountDeletion() {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data: pending, isLoading } = useQuery({
    queryKey: ["my-deletion-request"],
    queryFn: getMyPendingDeletionRequest,
    staleTime: 60_000,
  });

  const submit = async () => {
    if (confirmText.trim().toUpperCase() !== "SUPPRIMER") {
      toast.error('Tapez exactement « SUPPRIMER » pour confirmer.');
      return;
    }
    setSubmitting(true);
    try {
      await createMyDeletionRequest(reason);
      toast.success("Demande enregistrée. Nous te recontacterons par e-mail.");
      setReason("");
      setConfirmText("");
      setExpanded(false);
      await qc.invalidateQueries({ queryKey: ["my-deletion-request"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la demande.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    if (!pending) return;
    setSubmitting(true);
    try {
      await cancelMyDeletionRequest(pending.id);
      toast.success("Demande annulée.");
      await qc.invalidateQueries({ queryKey: ["my-deletion-request"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'annulation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="suppression-compte"
      className="scroll-mt-24 space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 backdrop-blur"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold">Supprimer mon compte</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Conformément au RGPD (article 17), vous pouvez demander la suppression de votre compte
            KAZEN et de vos données personnelles. Vos contributions publiques (playlists partagées,
            avis, messages du forum) seront anonymisées avant suppression, afin de préserver le
            contexte des discussions communautaires.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : pending ? (
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <p className="text-sm font-semibold">Demande en cours de traitement</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Reçue le {new Date(pending.created_at).toLocaleDateString("fr-FR")}. Vous recevrez un
            e-mail de confirmation lors de la suppression effective. Vous pouvez annuler tant
            qu'elle n'a pas été traitée.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={cancel}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Annuler ma demande
          </Button>
        </div>
      ) : !expanded ? (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setExpanded(true)}
        >
          <Trash2 className="h-3.5 w-3.5" /> Demander la suppression
        </Button>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
          <label className="block text-xs font-medium text-muted-foreground">
            Motif (facultatif)
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Aidez-nous à comprendre (optionnel, 500 caractères max)."
              maxLength={500}
              rows={3}
              className="mt-1"
            />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Tapez <strong>SUPPRIMER</strong> pour confirmer
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              autoComplete="off"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={submit}
              disabled={submitting || confirmText.trim().toUpperCase() !== "SUPPRIMER"}
              className="gap-2"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Envoyer la demande
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
              Annuler
            </Button>
          </div>
          <p className="text-[0.7rem] text-muted-foreground">
            En attendant le traitement (généralement sous 30 jours, RGPD art. 12.3), vous pouvez
            continuer à utiliser KAZEN normalement, ou annuler votre demande.
          </p>
        </div>
      )}
    </section>
  );
}
