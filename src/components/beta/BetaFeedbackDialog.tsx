import { useState } from "react";
import { toast } from "sonner";
import { MessageSquarePlus, Loader2, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import {
  submitBetaFeedback,
  BETA_FEEDBACK_CATEGORY_LABELS,
  type BetaFeedbackCategory,
} from "@/lib/beta-feedback.functions";

const CATEGORIES = Object.keys(
  BETA_FEEDBACK_CATEGORY_LABELS,
) as BetaFeedbackCategory[];

/**
 * KAZEN Phase 17 — discreet beta feedback entry point. Authenticated members
 * only; input is bounded and rate-limited server-side (RLS + DB trigger).
 */
export function BetaFeedbackDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<BetaFeedbackCategory>("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const send = useServerFn(submitBetaFeedback);

  if (!user) return null;

  const handleSubmit = async () => {
    if (title.trim().length < 3) {
      toast.error("Ajoutez un titre plus descriptif.");
      return;
    }
    if (body.trim().length < 5) {
      toast.error("Ajoutez un message plus détaillé.");
      return;
    }
    setBusy(true);
    try {
      await send({ data: { category, title, body } });
      toast.success("Merci ! Votre retour a bien été envoyé.");
      setOpen(false);
      setTitle("");
      setBody("");
      setCategory("bug");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Envoi impossible pour le moment.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="gap-1.5">
            <MessageSquarePlus className="h-4 w-4" />
            Retour bêta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Un retour sur la bêta ?</DialogTitle>
          <DialogDescription>
            KAZEN est en bêta. Signalez un bug, proposez une amélioration ou un
            titre manquant — chaque retour nous aide.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as BetaFeedbackCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {BETA_FEEDBACK_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="beta-feedback-title">Titre</Label>
            <Input
              id="beta-feedback-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Résumé court"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="beta-feedback-body">Message</Label>
            <Textarea
              id="beta-feedback-body"
              value={body}
              maxLength={2000}
              rows={5}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Décrivez le problème ou l'idée…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={busy} className="gap-1.5">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
