import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; to: string };
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2.5 font-display text-xl font-bold tracking-[-0.02em] text-foreground sm:text-2xl">
          <span aria-hidden="true" className="h-5 w-1 shrink-0 rounded-full aurora-bg sm:h-6" />
          <span className="truncate">{title}</span>
        </h2>
        {subtitle ? <p className="mt-1.5 pl-[0.9rem] text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action ? (
        <Link
          to={action.to}
          className="focus-ring group inline-flex shrink-0 items-center gap-1 rounded-full px-1 text-sm font-semibold text-primary transition-colors hover:text-foreground"
        >
          {action.label}
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        <span className="aurora-text">{title}</span>
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
