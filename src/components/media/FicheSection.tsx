import { type ReactNode } from "react";

interface FicheSectionProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Homogeneous premium section wrapper for detail pages. Keeps every block on a
 * fiche visually consistent: a compact heading with an optional icon/action and
 * generous, readable content spacing.
 */
export function FicheSection({ title, icon, action, children, className }: FicheSectionProps) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          {icon ? <span className="text-primary">{icon}</span> : null}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
