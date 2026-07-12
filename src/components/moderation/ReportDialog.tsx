import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import {
  submitContentReport,
  type ModerationTargetType,
} from "@/lib/moderation.functions";

const REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam ou publicité" },
  { value: "harassment", label: "Harcèlement ou propos haineux" },
  { value: "inappropriate", label: "Contenu inapproprié" },
  { value: "spoiler", label: "Spoiler non signalé" },
  { value: "misinformation", label: "Information trompeuse" },
  { value: "other", label: "Autre" },
];

const DETAILS_MAX = 2000;

/**
 * KAZEN — Action « Signaler » discrète et réutilisable.
 * S'appuie sur le backend de modération (Phase C) : le serveur dérive le
 * signaleur depuis auth.uid() et déduplique les rapports ouverts.
 */
export function ReportDialog({
  targetType,
  targetId,
  label = "Signaler",
  className,
}: {
  targetType: ModerationTargetType;
  targetId: string;
  label?: string;
  className?: string;
}) {
  const { user } = useAuth();
  const submit = useServerFn(submitContentReport);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setReason("");
    setDetails("");
    setPending(false);
    setDone(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTimeout(reset, 200);
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Connectez-vous pour signaler ce contenu.");
      return;
    }
    if (!reason) {
      toast.error("Choisissez un motif.");
      return;
    }
    setPending(true);
    try {
      const chosen = REASONS.find((r) => r.value === reason)?.label ?? reason;
      await submit({
        data: {
          targetType,
          targetId,
          reason: chosen,
          details: details.trim() || undefined,
        },
      });
      setDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // La contrainte d'unicité empêche les doublons de rapports ouverts.
      if (/duplicate|unique|conflict/i.test(msg)) {
        toast.info("Vous avez déjà signalé ce contenu. Merci, il est en attente de revue.");
        handleOpenChange(false);
      } else {
        toast.error("Le signalement n'a pas pu être envoyé. Réessayez.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            className ??
            "focus-ring inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
          }
          aria-label="Signaler ce contenu"
        >
          <Flag className="h-3.5 w-3.5" />
          <span>{label}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <div className="py-2">
            <DialogHeader>
              <DialogTitle>Signalement envoyé</DialogTitle>
              <DialogDescription>
                Merci. Notre équipe de modération va examiner ce contenu. Il
                reste visible tant qu'aucune décision n'a été prise.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="aurora" onClick={() => handleOpenChange(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Signaler ce contenu</DialogTitle>
              <DialogDescription>
                Aidez-nous à garder KAZEN sain. Votre signalement est
                confidentiel.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Motif</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisissez un motif" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-details">Détails (facultatif)</Label>
                <Textarea
                  id="report-details"
                  value={details}
                  maxLength={DETAILS_MAX}
                  rows={3}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Ajoutez un contexte utile pour la modération…"
                  className="resize-y text-sm"
                />
                <p className="text-right text-[11px] text-muted-foreground">
                  {details.length}/{DETAILS_MAX}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button variant="aurora" onClick={handleSubmit} disabled={pending}>
                {pending ? "Envoi…" : "Envoyer le signalement"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
