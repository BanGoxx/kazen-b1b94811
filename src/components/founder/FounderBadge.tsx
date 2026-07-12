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
        "group/founder relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-accent/45 bg-accent/12 font-semibold uppercase tracking-wide text-accent shadow-[inset_0_1px_0_0_var(--color-accent)/0.15,0_2px_12px_-6px_var(--color-accent)] backdrop-blur-sm transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:shadow-[inset_0_1px_0_0_var(--color-accent)/0.2,0_4px_18px_-6px_var(--color-accent)]",
        isSm ? "px-2 py-0.5 text-[0.62rem]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-accent/25 opacity-0 blur-[2px] transition-opacity duration-200 group-hover/founder:animate-[badge-sheen_0.9s_ease-out] group-hover/founder:opacity-100"
      />
      <Crown className={isSm ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      Fondateur
    </span>
  );
}
