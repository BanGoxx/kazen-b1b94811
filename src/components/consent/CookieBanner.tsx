import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useConsent } from "@/lib/consent";
import { PreferencesDialog } from "./PreferencesDialog";

/**
 * First-visit consent banner. Displayed until the user has made an explicit
 * choice. Never treats closure, scroll or continued navigation as consent —
 * the banner stays visible until "Tout accepter", "Tout refuser" or a save
 * action from the preferences panel.
 */
export function CookieBanner() {
  const { decided, acceptAll, denyAll, openPreferences, preferencesOpen } = useConsent();

  return (
    <>
      {!decided && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="kazen-consent-title"
          aria-describedby="kazen-consent-desc"
          className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:px-6"
        >
          <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card/95 p-4 shadow-[var(--shadow-card)] backdrop-blur sm:p-5">
            <h2 id="kazen-consent-title" className="text-sm font-semibold text-foreground">
              Vos préférences de confidentialité
            </h2>
            <p id="kazen-consent-desc" className="mt-1 text-xs leading-relaxed text-muted-foreground">
              KAZEN utilise uniquement les stockages strictement nécessaires au
              fonctionnement du service (connexion, préférence d'interface).
              Les contenus externes (lecteurs vidéo YouTube) restent bloqués
              tant que vous ne les avez pas autorisés. Vous pouvez modifier
              vos choix à tout moment.{" "}
              <Link to="/confidentialite" className="text-primary hover:underline">
                Politique de confidentialité
              </Link>
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="aurora" onClick={acceptAll}>
                Tout accepter
              </Button>
              <Button size="sm" variant="outline" onClick={denyAll}>
                Tout refuser
              </Button>
              <Button size="sm" variant="ghost" onClick={openPreferences}>
                Personnaliser
              </Button>
            </div>
          </div>
        </div>
      )}
      <PreferencesDialog open={preferencesOpen} />
    </>
  );
}
