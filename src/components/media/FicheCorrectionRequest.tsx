import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Flag, CheckCircle2, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import {
  CORRECTION_CATEGORY_LABELS,
  CORRECTION_CATEGORY_ORDER,
  CORRECTION_STATUS_LABELS,
  MAX_CORRECTION_BODY,
  useFicheCorrectionMutations,
  useMyFicheCorrections,
  type CorrectionCategory,
} from "@/lib/fiche-corrections";
import { cn } from "@/lib/utils";

/**
 * Member-facing "Signaler une erreur" flow for a fiche. Authenticated only,
 * bounded text, rate-limited server-side, and never edits catalogue data.
 * Shows the member their own past reports for this fiche with live status.
 */
export function FicheCorrectionRequest({
  source,
  externalId,
  mediaTitle,
  defaultCategory,
}: {
  source: string;
  externalId: string;
  mediaTitle: string;
  defaultCategory?: CorrectionCategory;
}) {
  const { user, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<CorrectionCategory>(
    defaultCategory ?? "incorrect_metadata",
  );
  const [body, setBody] = useState("");
  const { submit } = useFicheCorrectionMutations();
  const mine = useMyFicheCorrections(source, externalId);

  if (!ready || !user) return null;

  const remaining = MAX_CORRECTION_BODY - body.length;

  const handleSubmit = async () => {
    if (!body.trim()) {
      toast.error("Décrivez brièvement l'erreur constatée.");
      return;
    }
    try {
      await submit.mutateAsync({ source, externalId, mediaTitle, category, body });
      toast.success("Signalement envoyé. Merci ! L'équipe KAZEN l'examinera.");
      setBody("");
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "rate-limit") {
        toast.error("Trop de signalements récents. Réessayez dans un moment.");
      } else if (msg === "duplicate") {
        toast.error("Vous avez déjà un signalement ouvert de ce type sur cette fiche.");
      } else {
        toast.error("Impossible d'envoyer le signalement pour le moment.");
      }
    }
  };

  const openReports = (mine.data ?? []).filter(
    (r) => r.status !== "accepted" && r.status !== "rejected",
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <Flag className="h-4 w-4" />
          Signaler une erreur
          {openReports.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[11px]">
              {openReports.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Signaler une erreur</DialogTitle>
          <DialogDescription>
            Aidez-nous à améliorer cette fiche. Votre signalement est examiné manuellement
            et ne modifie jamais la fiche automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type d'erreur</label>
            <Select value={category} onValueChange={(v) => setCategory(v as CorrectionCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CORRECTION_CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CORRECTION_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Détails</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_CORRECTION_BODY))}
              rows={4}
              placeholder="Décrivez l'erreur (ex. l'affiche ne correspond pas, la plateforme X manque…)."
            />
            <p className={cn("text-right text-xs", remaining < 80 ? "text-destructive" : "text-muted-foreground")}>
              {remaining} caractères restants
            </p>
          </div>

          {(mine.data?.length ?? 0) > 0 && (
            <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">Vos signalements sur cette fiche</p>
              <ul className="space-y-1">
                {mine.data!.slice(0, 4).map((r) => {
                  const closed = r.status === "accepted" || r.status === "rejected";
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-muted-foreground">
                        {CORRECTION_CATEGORY_LABELS[r.category]}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {closed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                        {CORRECTION_STATUS_LABELS[r.status]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={submit.isPending} className="gap-2">
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
