import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FounderBadgeProps {
  size?: "sm" | "md";
  className?: string;
}

/**
 * Premium public "Fondateur" marker. Derived only from the protected Owner
 * role — never self-assignable. Kept elegant and restrained.
 */
export function FounderBadge({ size = "sm", className }: FounderBadgeProps) {
  const isSm = size === "sm";
  return (
    <span
      title="Compte fondateur de KAZEN"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-accent/45 bg-accent/12 font-semibold uppercase tracking-wide text-accent shadow-[inset_0_1px_0_0_var(--color-accent)/0.15,0_2px_12px_-6px_var(--color-accent)] backdrop-blur-sm",
        isSm ? "px-2 py-0.5 text-[0.62rem]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <Crown className={isSm ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      Fondateur
    </span>
  );
}
