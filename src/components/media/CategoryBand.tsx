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
  className,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span
        aria-hidden="true"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card/60 text-primary shadow-sm backdrop-blur"
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {label}
        </h2>
        {description ? (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div
        aria-hidden="true"
        className="ml-1 h-px flex-1 bg-gradient-to-r from-border to-transparent"
      />
    </div>
  );
}
