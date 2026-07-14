import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { BETA_PREMIUM_COPY } from "@/lib/premium";

type Size = "sm" | "md";

/**
 * Badge « Premium bêta » — état de présentation temporaire (Phase 24).
 * Purement cosmétique : n'accorde aucun privilège serveur et ne doit jamais
 * primer visuellement sur les rôles Owner / Fondateur / modération.
 */
export function PremiumBetaBadge({
  size = "md",
  label = BETA_PREMIUM_COPY.badge,
  className,
}: {
  size?: Size;
  label?: string;
  className?: string;
}) {
  return (
    <span
      title="Accès Premium offert pendant la bêta"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 font-semibold text-primary backdrop-blur",
        size === "sm" ? "px-2 py-0.5 text-[0.65rem]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <Crown className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {label}
    </span>
  );
}
