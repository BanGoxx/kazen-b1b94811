import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles, HeartHandshake, Crown, Gift, Info } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { PremiumBetaBadge } from "@/components/premium/PremiumBetaBadge";
import { useAuth } from "@/lib/auth";
import {
  SUPPORTER_PITCH,
  BETA_PREMIUM_COPY,
  FUTURE_PLUS_PRICING,
  FREE_BASELINE,
  PLUS_FUTURE,
  useBetaPremium,
} from "@/lib/premium";

export const Route = createFileRoute("/soutien")({
  head: () => ({
    meta: [
      { title: "Soutenir KAZEN — Premium offert pendant la bêta" },
      {
        name: "description",
        content:
          "Pendant la bêta, tous les membres profitent gratuitement de l'expérience KAZEN Premium. KAZEN restera accessible gratuitement ; une formule KAZEN Plus facultative pourra arriver plus tard. Aucun paiement n'est actif.",
      },
      { property: "og:title", content: "Soutenir KAZEN — Premium offert pendant la bêta" },
      {
        property: "og:description",
        content:
          "Pendant la bêta, tous les membres profitent gratuitement de l'expérience KAZEN Premium. Aucun paiement n'est actuellement actif.",
      },
      { property: "og:url", content: "https://kazen.lovable.app/soutien" },
    ],
    links: [{ rel: "canonical", href: "https://kazen.lovable.app/soutien" }],
  }),
  component: SoutienPage,
});

function SoutienPage() {
  const { user } = useAuth();
  const { isBetaPremium } = useBetaPremium();

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
              Soutenir KAZEN
            </h1>
            <p className="text-balance text-sm leading-relaxed text-muted-foreground sm:text-base">
              KAZEN restera toujours gratuit pour l'essentiel. Merci de participer à
              la bêta et de nous aider à construire la meilleure expérience de
              découverte et de suivi.
            </p>
          </div>
        </header>

        {/* KAZEN Premium — offert pendant la bêta */}
        <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-glow backdrop-blur sm:p-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl aurora-bg text-white shadow-glow">
                <Gift className="h-5 w-5" />
              </span>
              <h2 className="font-display text-xl font-bold tracking-[-0.02em]">
                KAZEN Premium — offert pendant la bêta
              </h2>
              <PremiumBetaBadge size="sm" />
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Tous les membres profitent actuellement gratuitement de l'expérience
              KAZEN Premium pendant la bêta.
            </p>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {BETA_PREMIUM_COPY.secondary}
            </p>
            {isBetaPremium ? (
              <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-card/50 px-4 py-3">
                <Crown className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm">
                  {BETA_PREMIUM_COPY.primary} <span className="text-muted-foreground">Merci 💜</span>
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button asChild variant="aurora">
                  <Link to="/auth" search={{ redirect: "/soutien" }}>
                    Se connecter pour en profiter
                  </Link>
                </Button>
                <span className="text-xs text-muted-foreground">
                  Aucun paiement, aucun engagement.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Comparatif Gratuit vs futur Plus */}
        <section className="rounded-2xl border border-border bg-card/40 p-4 backdrop-blur sm:p-6">
          <h2 className="font-display text-xl font-bold tracking-[-0.02em]">
            KAZEN Gratuit &amp; futur KAZEN Plus
          </h2>
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{BETA_PREMIUM_COPY.betaNotice}</span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {/* Gratuit */}
            <div className="flex flex-col rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
              <div className="flex items-center gap-2 text-muted-foreground">
                <HeartHandshake className="h-5 w-5" />
                <span className="font-display text-lg font-bold text-foreground">
                  KAZEN Gratuit
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                La base envisagée, accessible sans paiement.
              </p>
              <p className="mt-3 font-display text-2xl font-extrabold">0 €</p>
              <ul className="mt-4 space-y-2">
                {FREE_BASELINE.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Futur Plus */}
            <div className="relative flex flex-col rounded-2xl border border-primary/40 bg-card/60 p-6 backdrop-blur">
              <div className="flex items-center gap-2 text-primary">
                <Crown className="h-5 w-5" />
                <span className="font-display text-lg font-bold aurora-text">
                  KAZEN Plus
                </span>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
                  Bientôt
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Bénéfices avancés possibles — non disponibles aujourd'hui.
              </p>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-display text-2xl font-extrabold">
                  {FUTURE_PLUS_PRICING.founding}
                  <span className="text-sm font-normal text-muted-foreground"> /mois</span>
                </p>
                <span className="text-xs text-muted-foreground">
                  possible tarif fondateur
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                puis {FUTURE_PLUS_PRICING.standard} /mois envisagé (tarif standard possible)
              </p>
              <ul className="mt-4 space-y-2">
                {PLUS_FUTURE.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            {FUTURE_PLUS_PRICING.disclaimer} {FUTURE_PLUS_PRICING.foundingNote}
          </p>
        </section>

        {/* Engagement / transparence */}
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 backdrop-blur sm:p-6">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Crown className="h-3.5 w-3.5" /> Notre engagement
          </div>
          <h2 className="font-display text-xl font-bold tracking-[-0.02em]">
            Transparence
          </h2>
          <ul className="mt-3 max-w-2xl space-y-2 text-sm text-muted-foreground">
            <li>KAZEN est en bêta et l'accès Premium est actuellement offert.</li>
            <li>Aucun paiement n'est actif ; aucune carte n'est demandée.</li>
            <li>KAZEN Plus, s'il arrive, restera facultatif.</li>
            <li>Une version gratuite utile et complète restera disponible.</li>
            <li>
              Certaines fonctionnalités de confort avancées pourront devenir payantes
              plus tard — les membres seront informés avant tout changement.
            </li>
            <li>Personne ne sera facturé automatiquement.</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
