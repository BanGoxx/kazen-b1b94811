import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PREMIUM_FEATURES, SUPPORTER_PITCH } from "@/lib/premium";

/**
 * Invite d'upgrade élégante et non intrusive.
 * S'ouvre uniquement au clic sur un élément déclencheur (jamais en pop-up auto).
 */
export function UpgradeDialog({
  trigger,
  highlightFeatureId,
}: {
  trigger: ReactNode;
  highlightFeatureId?: string;
}) {
  const perks = PREMIUM_FEATURES.filter((f) => f.supporter !== false).slice(0, 6);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md overflow-hidden border-primary/20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 aurora-bg opacity-10" />
        <DialogHeader className="relative">
          <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> {SUPPORTER_PITCH.title}
          </div>
          <DialogTitle className="font-display text-2xl">
            {SUPPORTER_PITCH.tagline}
          </DialogTitle>
          <DialogDescription>{SUPPORTER_PITCH.description}</DialogDescription>
        </DialogHeader>

        <ul className="relative my-2 space-y-2">
          {perks.map((f) => {
            const Icon = f.icon;
            const highlighted = f.id === highlightFeatureId;
            return (
              <li
                key={f.id}
                className={
                  "flex items-start gap-3 rounded-lg px-2 py-1.5 " +
                  (highlighted ? "bg-primary/5 ring-1 ring-primary/20" : "")
                }
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-sm font-medium">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </div>
                <Check className="ml-auto mt-1 h-4 w-4 shrink-0 text-primary/70" />
              </li>
            );
          })}
        </ul>

        <div className="relative flex flex-col gap-2 pt-1">
          <Button asChild variant="aurora" className="w-full">
            <Link to="/soutien">Découvrir le Soutien</Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            KAZEN reste gratuit pour l'essentiel. Aucun engagement.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
