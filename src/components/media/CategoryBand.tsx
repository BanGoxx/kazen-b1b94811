import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chapter marker used on the Découverte page to separate the Anime / Séries /
 * Films clusters, giving a clear scroll rhythm without overloading the UI.
 */
export function CategoryBand({
  icon: Icon,
  label,
  description,
  kicker = "Chapitre",
  className,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  kicker?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 sm:gap-5", className)}>
      <span
        aria-hidden="true"
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 to-transparent text-primary shadow-[var(--shadow-inset-line)] backdrop-blur transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105"
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <span className="eyebrow block text-[0.62rem] text-primary/80">{kicker}</span>
        <h2 className="mt-0.5 font-display text-[1.6rem] font-extrabold leading-none tracking-[-0.03em] sm:text-4xl">
          {label}
        </h2>
        {description ? (
          <p className="mt-1.5 truncate text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div
        aria-hidden="true"
        className="ml-1 h-px flex-1 bg-gradient-to-r from-border via-border/40 to-transparent"
      />
    </div>
  );
}
