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
        "inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 font-semibold uppercase tracking-wide text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.15),0_2px_10px_-4px_hsl(var(--primary)/0.6)]",
        isSm ? "px-2 py-0.5 text-[0.62rem]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <Crown className={isSm ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      Fondateur
    </span>
  );
}
