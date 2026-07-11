import { createFileRoute } from "@tanstack/react-router";
import { Check, Minus, Sparkles, HeartHandshake, Crown } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { SupporterBadge } from "@/components/premium/SupporterBadge";
import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";
import {
  PREMIUM_FEATURES,
  SUPPORTER_PITCH,
  SUPPORTER_PRICE,
  setSupporterPreview,
  usePremium,
  type PremiumFeature,
} from "@/lib/premium";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/soutien")({
  head: () => ({
    meta: [
      { title: "Soutien KAZEN — Débloquez les outils premium" },
      {
        name: "description",
        content:
          "Soutenez KAZEN et débloquez des outils avancés : filtres croisés, rappels de sorties, statistiques détaillées et thèmes exclusifs. Le cœur reste gratuit.",
      },
      { property: "og:title", content: "Soutien KAZEN — Débloquez les outils premium" },
      {
        property: "og:description",
        content:
          "Soutenez KAZEN et débloquez des outils avancés : filtres croisés, rappels de sorties, statistiques détaillées et thèmes exclusifs. Le cœur reste gratuit.",
      },
      { property: "og:url", content: "https://kazen.lovable.app/soutien" },
    ],
    links: [{ rel: "canonical", href: "https://kazen.lovable.app/soutien" }],
  }),
  component: SoutienPage,
});

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-primary" />;
  if (value === false)
    return <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" />;
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

function FeatureRow({ f }: { f: PremiumFeature }) {
  const Icon = f.icon;
  return (
    <tr className="border-t border-border/60">
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{f.label}</p>
            <p className="line-clamp-1 text-xs text-muted-foreground">{f.description}</p>
          </div>
        </div>
      </td>
      <td className="px-2 py-3 text-center">
        <Cell value={f.free} />
      </td>
      <td className="px-2 py-3 text-center">
        <Cell value={f.supporter} />
      </td>
    </tr>
  );
}

function SoutienPage() {
  const { user } = useAuth();
  const { isSupporter } = usePremium();

  return (
    <AppShell>
      <div className="section-container max-w-4xl space-y-10">
        {/* Hero */}
        <header className="grain relative overflow-hidden rounded-3xl border border-primary/20 p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute inset-0 aurora-bg opacity-[0.08]" />
          <div className="relative mx-auto max-w-xl space-y-4">
            <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> {SUPPORTER_PITCH.title}
            </div>
            <h1 className="text-balance font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
              {SUPPORTER_PITCH.tagline}
            </h1>
            <p className="text-balance text-sm leading-relaxed text-muted-foreground sm:text-base">
              {SUPPORTER_PITCH.description}
            </p>
            <p className="mx-auto max-w-md text-balance text-xs leading-relaxed text-primary/90">
              Pendant la bêta, les outils Soutien sont ouverts gratuitement pour
              que tu puisses les tester. Aucun paiement n'est requis pour le moment.
            </p>
            {isSupporter ? (
              <div className="flex items-center justify-center gap-2 pt-2">
                <SupporterBadge />
                <span className="text-sm text-muted-foreground">Merci pour ton soutien 💜</span>
              </div>
            ) : null}

          </div>
        </header>

        {/* Tarifs */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
            <div className="flex items-center gap-2 text-muted-foreground">
              <HeartHandshake className="h-5 w-5" />
              <span className="font-display text-lg font-bold text-foreground">Gratuit</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Toute la découverte, les listes et le suivi personnel.
            </p>
            <p className="mt-4 font-display text-3xl font-extrabold">0 €</p>
            <p className="text-xs text-muted-foreground">Pour toujours</p>
            <Button asChild variant="premium" className="mt-6">
              <Link to="/">Continuer gratuitement</Link>
            </Button>
          </div>

          <div className="relative flex flex-col rounded-2xl border border-primary/40 bg-card/60 p-6 shadow-glow backdrop-blur">
            <div className="absolute right-4 top-4">
              <SupporterBadge size="sm" />
            </div>
            <div className="flex items-center gap-2 text-primary">
              <Crown className="h-5 w-5" />
              <span className="font-display text-lg font-bold aurora-text">Soutien</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Les outils avancés + le badge, pour aller plus loin.
            </p>
            <p className="mt-4 font-display text-3xl font-extrabold">
              {SUPPORTER_PRICE.monthly}
              <span className="text-sm font-normal text-muted-foreground"> /mois</span>
            </p>
            <p className="text-xs text-muted-foreground">
              ou {SUPPORTER_PRICE.yearly} /an
            </p>
            {!user ? (
              <Button asChild variant="aurora" className="mt-6">
                <Link to="/auth" search={{ redirect: "/soutien" }}>
                  Se connecter pour soutenir
                </Link>
              </Button>
            ) : (
              <Button
                variant="aurora"
                className="mt-6"
                onClick={() => setSupporterPreview(!isSupporter)}
              >
                {isSupporter ? "Désactiver l'aperçu" : "Activer l'aperçu Soutien"}
              </Button>
            )}
            <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
              Aperçu de démonstration — le paiement arrive bientôt.
            </p>
          </div>
        </section>

        {/* Comparatif */}
        <section className="rounded-2xl border border-border bg-card/40 p-4 backdrop-blur sm:p-6">
          <h2 className="mb-4 font-display text-xl font-bold tracking-[-0.02em]">
            Comparatif des fonctionnalités
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem]">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 text-left font-semibold">Fonctionnalité</th>
                  <th className="px-2 pb-2 text-center font-semibold">Gratuit</th>
                  <th className="px-2 pb-2 text-center font-semibold text-primary">Soutien</th>
                </tr>
              </thead>
              <tbody>
                {PREMIUM_FEATURES.map((f) => (
                  <FeatureRow key={f.id} f={f} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Certaines fonctionnalités Soutien sont en cours de développement et
            arriveront progressivement.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
