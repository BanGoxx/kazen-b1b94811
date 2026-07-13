import { Link } from "@tanstack/react-router";
import { Loader2, MailCheck, AlertTriangle, RefreshCw, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/media/SafeImage";
import type { DigestModel, DigestMediaRef } from "@/lib/digest";

/** Renders an internal KAZEN link from an absolute digest href. */
function internalPath(href: string): string {
  try {
    return new URL(href).pathname || "/";
  } catch {
    return "/";
  }
}

function MediaRow({ m }: { m: DigestMediaRef }) {
  return (
    <Link
      to={internalPath(m.href)}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-2.5 transition-colors hover:border-primary/40"
    >
      <div className="h-16 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
        <SafeImage src={m.posterUrl} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{m.title}</p>
        {m.reason ? (
          <p className="truncate text-xs text-primary/80">{m.reason}</p>
        ) : m.releaseDate ? (
          <p className="truncate text-xs text-muted-foreground">
            {new Date(m.releaseDate).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export function DigestPreview({
  model,
  isLoading,
  providerFailed,
  onRetry,
  contextLabel,
}: {
  model: DigestModel | null;
  isLoading: boolean;
  providerFailed?: boolean;
  onRetry?: () => void;
  contextLabel?: string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card/40 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Génération de l'aperçu…
      </div>
    );
  }

  if (providerFailed || !model) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/40 p-8 text-center">
        <AlertTriangle className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Impossible de générer l'aperçu pour le moment (source temporairement indisponible).
        </p>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Réessayer
          </Button>
        ) : null}
      </div>
    );
  }

  if (model.isEmpty) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Aucun contenu à afficher dans cet aperçu avec vos préférences actuelles.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/60 shadow-sm">
      {/* Preview-only banner */}
      <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-4 py-2.5 text-xs font-medium text-primary">
        <MailCheck className="h-4 w-4" /> Aperçu — aucun email n'a été envoyé.
        {contextLabel ? <span className="text-muted-foreground">· {contextLabel}</span> : null}
      </div>

      <div className="space-y-6 p-5">
        <header className="space-y-1.5 border-b border-border/60 pb-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Objet · {model.subject}
          </p>
          <h3 className="font-display text-xl font-extrabold">{model.heading}</h3>
          <p className="text-sm text-muted-foreground">{model.intro}</p>
        </header>

        {model.sections.map((s) => (
          <section key={s.id} className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wide text-foreground/80">
              {s.title}
            </h4>
            {s.kind === "media" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {s.media?.map((m) => <MediaRow key={m.key} m={m} />)}
              </div>
            ) : (
              <div className="space-y-2">
                {s.articles?.map((a) => (
                  <Link
                    key={a.slug}
                    to={internalPath(a.href)}
                    className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-card/40 p-3 transition-colors hover:border-primary/40"
                  >
                    <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{a.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{a.excerpt}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ))}

        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
          <Button asChild variant="aurora" size="sm">
            <Link to={internalPath(model.cta.href)}>{model.cta.label}</Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            Gérer mes préférences · Se désabonner (liens ajoutés lors de l'envoi réel)
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">{model.footerNote}</p>
      </div>
    </div>
  );
}
