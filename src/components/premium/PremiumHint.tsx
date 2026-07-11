import { Sparkles } from "lucide-react";
import { UpgradeDialog } from "./UpgradeDialog";
import { cn } from "@/lib/utils";

/**
 * Marqueur discret « fonctionnalité Soutien ».
 * À poser à côté d'un contrôle avancé pour signaler l'upgrade sans bloquer.
 */
export function PremiumHint({
  featureId,
  label = "Soutien",
  className,
}: {
  featureId?: string;
  label?: string;
  className?: string;
}) {
  return (
    <UpgradeDialog
      highlightFeatureId={featureId}
      trigger={
        <button
          type="button"
          className={cn(
            "focus-ring inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[0.65rem] font-semibold text-primary transition-colors hover:bg-primary/10",
            className,
          )}
        >
          <Sparkles className="h-3 w-3" />
          {label}
        </button>
      }
    />
  );
}
