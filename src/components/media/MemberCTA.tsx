import { Link } from "@tanstack/react-router";
import { Bookmark, Heart, ListChecks, Sparkles, StickyNote } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const PERKS = [
  { icon: Bookmark, label: "Suivre vos titres" },
  { icon: Heart, label: "Marquer vos favoris" },
  { icon: Sparkles, label: "Noter & prioriser" },
  { icon: StickyNote, label: "Notes & tags perso" },
];

// Discreet, premium invitation shown only to signed-out visitors to surface the
// value of an account without being intrusive.
export function MemberCTA() {
  const { user, ready } = useAuth();
  if (!ready || user) return null;

  return (
    <section
      aria-labelledby="member-cta-title"
      className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-6 backdrop-blur sm:p-8"
    >
      <div
        aria-hidden="true"
        className="ambient-glow pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, oklch(0.66 0.24 300 / 0.22), transparent)" }}
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5 text-primary" /> Espace personnel
          </div>
          <h2 id="member-cta-title" className="font-display text-2xl font-extrabold sm:text-3xl">
            Créez votre <span className="aurora-text">compte KAZEN</span>
          </h2>
          <p className="text-muted-foreground">
            Gardez vos anime, séries et films au même endroit : suivez leur statut, notez-les et
            organisez tout avec vos propres tags. C'est gratuit.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {PERKS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
              >
                <Icon className="h-3.5 w-3.5 text-primary" /> {label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <Button asChild variant="aurora" size="lg">
            <Link to="/auth" search={{ redirect: undefined }}>
              Créer mon compte
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link to="/auth" search={{ redirect: undefined }}>
              J'ai déjà un compte
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
