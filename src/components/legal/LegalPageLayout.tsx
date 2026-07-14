import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { LEGAL, LEGAL_DRAFT } from "@/lib/legal-config";

interface LegalPageLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Shared shell for the four legal drafts (mentions légales, CGU, politique de
 * confidentialité, règles communautaires). Renders a persistent draft banner
 * so no visitor can mistake the content for a final legal document — required
 * by Phase 26.2 MODE B while owner information (C1/C2/C3/C6) is missing.
 */
export function LegalPageLayout({ title, subtitle, children }: LegalPageLayoutProps) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      {LEGAL_DRAFT ? (
        <div
          role="note"
          className="mb-8 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Brouillon interne — non validé juridiquement
            </p>
            <p className="text-muted-foreground">
              Ce document est un brouillon préparé pendant la phase interne de mise en conformité de KAZEN.
              Il n'a pas été validé par un avocat ni un DPO, plusieurs informations obligatoires
              restent à compléter, et il ne constitue en aucun cas un engagement juridique définitif.
            </p>
          </div>
        </div>
      ) : null}

      <header className="mb-8 border-b border-border pb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">KAZEN — Documents</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-2 text-muted-foreground">{subtitle}</p> : null}
        <p className="mt-3 text-xs text-muted-foreground">
          Version {LEGAL.version} — dernière mise à jour {LEGAL.lastUpdated}
        </p>
      </header>

      <div className="prose prose-invert max-w-none space-y-6 text-[0.95rem] leading-relaxed text-foreground/90 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:text-foreground/85 [&_ul]:list-disc [&_ul]:pl-6 [&_ul>li]:my-1 [&_a]:text-primary [&_a:hover]:underline">
        {children}
      </div>

      <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
        <p>
          Autres documents :{" "}
          <Link to="/mentions-legales" className="text-primary hover:underline">
            Mentions légales
          </Link>{" "}
          ·{" "}
          <Link to="/cgu" className="text-primary hover:underline">
            CGU
          </Link>{" "}
          ·{" "}
          <Link to="/confidentialite" className="text-primary hover:underline">
            Confidentialité
          </Link>{" "}
          ·{" "}
          <Link to="/regles-communautaires" className="text-primary hover:underline">
            Règles communautaires
          </Link>
        </p>
      </footer>
    </article>
  );
}
