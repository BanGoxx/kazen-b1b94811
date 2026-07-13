import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getEmailDeliveryStatus,
  getDeliveryHistory,
  sendFounderTestEmail,
} from "@/lib/email-delivery.functions";
import type { DigestModel } from "@/lib/digest";

// KAZEN Founder Console — Phase 2 delivery panel.
// Owner-only. Shows provider config status, sends a REAL test email to the
// Owner's own verified address, and lists recent delivery attempts.

type Variant = "general" | "personalized";

const STATUS_STYLE: Record<string, string> = {
  sent: "text-emerald-400",
  queued: "text-amber-400",
  failed: "text-red-400",
  skipped: "text-muted-foreground",
};

const DIGEST_LABEL: Record<string, string> = {
  founder_test_general: "Test — général",
  founder_test_personalized: "Test — personnalisé",
};

export function FounderTestSender({
  generalModel,
  personalizedModel,
  modelsReady,
}: {
  generalModel: DigestModel | null;
  personalizedModel: DigestModel | null;
  modelsReady: boolean;
}) {
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getEmailDeliveryStatus);
  const historyFn = useServerFn(getDeliveryHistory);
  const sendFn = useServerFn(sendFounderTestEmail);
  const [pending, setPending] = useState<Variant | null>(null);

  const status = useQuery({
    queryKey: ["email-delivery-status"],
    queryFn: () => statusFn(),
    staleTime: 60_000,
  });

  const history = useQuery({
    queryKey: ["email-delivery-history"],
    queryFn: () => historyFn(),
    staleTime: 15_000,
  });

  const send = useMutation({
    mutationFn: (variant: Variant) => {
      const model = variant === "general" ? generalModel : personalizedModel;
      if (!model) throw new Error("Modèle indisponible.");
      return sendFn({ data: { variant, model } });
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Email de test envoyé à votre adresse.");
      } else if ("status" in res && res.status === "skipped") {
        toast.error("Fournisseur non configuré — envoi ignoré.");
      } else if ("reason" in res && res.reason) {
        const map: Record<string, string> = {
          cooldown: "Patientez quelques secondes avant un nouvel essai.",
          not_configured: "Fournisseur d'email non configuré.",
          no_email: "Aucune adresse email sur votre compte.",
          email_unconfirmed: "Votre adresse email n'est pas confirmée.",
          invalid: "Requête invalide.",
        };
        toast.error(map[res.reason] ?? "Envoi impossible.");
      } else {
        toast.error(
          ("errorMessage" in res && res.errorMessage) || "Échec de l'envoi.",
        );
      }
      void queryClient.invalidateQueries({ queryKey: ["email-delivery-history"] });
    },
    onError: () => toast.error("Échec de l'envoi du test."),
    onSettled: () => setPending(null),
  });

  const s = status.data;
  const canSend =
    Boolean(s?.canSendTest) && modelsReady && Boolean(generalModel && personalizedModel);

  return (
    <div className="space-y-6">
      {/* Provider status */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Fournisseur d'email</p>
            <p className="text-xs text-muted-foreground">
              {status.isLoading
                ? "Vérification…"
                : s?.configured
                  ? `${s.provider} — ${s.senderLabel ?? "expéditeur configuré"}`
                  : "Non configuré (mode aperçu sécurisé)"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              s?.configured
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {s?.configured ? "Configuré" : "Non configuré"}
          </span>
        </div>

        {s && !s.configured && s.missing.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Manquant : {s.missing.join(", ")}.
          </p>
        )}
        {s && (
          <p className="mt-2 text-xs text-muted-foreground">
            Destinataire du test :{" "}
            {s.ownerEmailMasked
              ? `${s.ownerEmailMasked}${s.ownerEmailConfirmed ? " (confirmé)" : " (non confirmé)"}`
              : "adresse introuvable"}
          </p>
        )}
      </div>

      {/* Send buttons */}
      <div className="flex flex-wrap gap-3">
        <SendButton
          label="Envoyer le test — général"
          variant="general"
          disabled={!canSend || send.isPending}
          loading={pending === "general"}
          onConfirm={() => {
            setPending("general");
            send.mutate("general");
          }}
          recipient={s?.ownerEmailMasked ?? ""}
        />
        <SendButton
          label="Envoyer le test — personnalisé"
          variant="personalized"
          disabled={!canSend || send.isPending}
          loading={pending === "personalized"}
          onConfirm={() => {
            setPending("personalized");
            send.mutate("personalized");
          }}
          recipient={s?.ownerEmailMasked ?? ""}
        />
      </div>
      {!canSend && !status.isLoading && (
        <p className="text-xs text-muted-foreground">
          {s?.configured
            ? "L'envoi de test nécessite une adresse email confirmée sur votre compte."
            : "Configurez un fournisseur d'email pour activer les envois de test."}
        </p>
      )}

      {/* Delivery history */}
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          Historique des envois
        </p>
        {history.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (history.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun envoi pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {history.data!.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {DIGEST_LABEL[row.digest_type] ?? row.digest_type}
                  </span>
                  <span className="text-muted-foreground">
                    {row.recipient_masked ?? "—"} ·{" "}
                    {new Date(row.created_at).toLocaleString("fr-FR")}
                  </span>
                  {row.failure_message_safe && (
                    <span className="text-red-400">{row.failure_message_safe}</span>
                  )}
                </div>
                <span
                  className={`font-semibold ${STATUS_STYLE[row.status] ?? "text-muted-foreground"}`}
                >
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SendButton({
  label,
  disabled,
  loading,
  onConfirm,
  recipient,
}: {
  label: string;
  variant: Variant;
  disabled: boolean;
  loading: boolean;
  onConfirm: () => void;
  recipient: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {loading ? "Envoi…" : label}
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Envoyer un email de test ?</AlertDialogTitle>
          <AlertDialogDescription>
            Un email réel sera envoyé à votre adresse ({recipient || "votre compte"}).
            Aucun autre membre n'est concerné.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Envoyer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
