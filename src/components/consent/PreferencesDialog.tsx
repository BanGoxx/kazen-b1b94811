import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useConsent } from "@/lib/consent";

/**
 * Cookie preferences panel. Exposes every optional category KAZEN actually
 * uses. Necessary storage is displayed as read-only "toujours actif".
 */
export function PreferencesDialog({ open }: { open: boolean }) {
  const { prefs, save, acceptAll, denyAll, closePreferences } = useConsent();
  const [externalMedia, setExternalMedia] = useState(prefs.externalMedia);

  useEffect(() => {
    if (open) setExternalMedia(prefs.externalMedia);
  }, [open, prefs.externalMedia]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closePreferences()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Préférences de confidentialité</DialogTitle>
          <DialogDescription>
            Choisissez les catégories que vous autorisez. Vous pouvez revenir
            ici à tout moment depuis le pied de page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Strictement nécessaires</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Session d'authentification, préférence de thème, préférence
                  de consentement, état de session du catalogue. Indispensables
                  au fonctionnement de KAZEN.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
                Toujours actif
              </span>
            </div>
          </section>

          <section className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="consent-external" className="text-sm font-semibold">
                  Contenus externes
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Chargement des lecteurs et miniatures YouTube pour les
                  bandes-annonces et clips. Sans cette autorisation, une
                  vignette KAZEN est affichée à la place et aucune requête
                  n'est envoyée à YouTube tant que vous ne cliquez pas
                  manuellement pour lancer une vidéo.
                </p>
              </div>
              <Switch
                id="consent-external"
                checked={externalMedia}
                onCheckedChange={setExternalMedia}
                aria-label="Activer les contenus externes"
              />
            </div>
          </section>

          <p className="text-[0.7rem] text-muted-foreground">
            KAZEN n'utilise actuellement aucun outil de mesure d'audience,
            aucun traceur publicitaire et aucun réseau social embarqué. Ces
            catégories n'apparaissent donc pas ici.
          </p>
        </div>

        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                denyAll();
                closePreferences();
              }}
            >
              Tout refuser
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                acceptAll();
                closePreferences();
              }}
            >
              Tout accepter
            </Button>
          </div>
          <Button
            variant="aurora"
            size="sm"
            onClick={() => {
              save({ externalMedia });
              closePreferences();
            }}
          >
            Enregistrer mes choix
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
