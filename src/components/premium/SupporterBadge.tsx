import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Size = "sm" | "md";

/**
 * Badge « Soutien » — cosmétique premium discret.
 * Utilisé sur le profil et à côté du nom d'affichage.
 */
export function SupporterBadge({
  size = "md",
  showLabel = true,
  className,
}: {
  size?: Size;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <span
      title="Membre Soutien KAZEN"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 font-semibold text-primary backdrop-blur",
        size === "sm" ? "px-2 py-0.5 text-[0.65rem]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <BadgeCheck className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {showLabel ? "Soutien" : null}
    </span>
  );
}
