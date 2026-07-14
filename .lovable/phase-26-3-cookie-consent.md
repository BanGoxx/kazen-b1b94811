# KAZEN — Phase 26.3 — Cookies, consentement et blocage préalable

## Résumé exécutif

Mise en place d'une couche de consentement first-party minimale, cohérente
avec l'usage réel de KAZEN. Un seul service optionnel est réellement chargé
depuis le navigateur : les lecteurs et miniatures YouTube. Il est désormais
bloqué avant tout consentement (aucune requête `img.youtube.com` ni iframe
YouTube n'est émise), et débloquable soit globalement via les préférences,
soit ponctuellement par un clic explicite sur la vidéo concernée.

Aucun nouveau service tiers, aucun traceur analytique ou publicitaire, aucune
migration base de données. Le stockage de la preuve est local (localStorage
first-party), suffisant tant qu'aucun besoin multi-appareils n'est démontré.

## Périmètre

- Audit exhaustif des cookies, localStorage, sessionStorage, IndexedDB, iframes
  et services tiers réellement chargés.
- Architecture de consentement (`src/lib/consent.tsx`).
- Bannière et panneau de préférences.
- Blocage préalable réel des lecteurs YouTube (VideoGallery, TrailerDialog).
- Accès permanent via le pied de page.
- Mise à jour §12 de la politique de confidentialité.

## Audit initial

- Phase 26.1R matérialisée : case d'âge (`src/routes/auth.tsx`), mention IA
  (`AssistantChat.tsx`), composant `AccountDeletion` monté dans `/profil`,
  table `account_deletion_requests` versionnée.
- Phase 26.2 en MODE B : quatre pages juridiques `noindex,nofollow` + footer.
- Aucun analytics, aucun pixel publicitaire, aucun widget social embarqué.

## Inventaire des cookies

Aucun cookie tiers n'est déposé par KAZEN. Le SDK Supabase (`@supabase/supabase-js`)
utilisé côté navigateur persiste sa session via **localStorage**, pas via
cookies. Aucun cookie d'analytics/publicité présent. Cookies uniquement
possibles : ceux éventuellement posés par YouTube **après** consentement et
lancement d'une vidéo — l'iframe est basculée en `youtube-nocookie.com` pour
minimiser cet effet.

| Nom | Domaine | Finalité | Nécessaire ? | Avant consentement | Après refus |
| --- | --- | --- | --- | --- | --- |
| (aucun) | — | — | — | — | — |

## LocalStorage

| Clé | Contenu | Finalité | Catégorie | Notes |
| --- | --- | --- | --- | --- |
| `sb-<project>-auth-token` | Session Supabase (JWT) | Authentification | Nécessaire | Géré par le SDK Supabase. Non supprimé au retrait des optionnels. |
| `nexus-theme` | `"light"` / `"dark"` | Préférence UI | Nécessaire (fonctionnelle) | First-party, aucune donnée personnelle. |
| `nexus:list:v1` | Listes pré-auth locales | Fonctionnel | Nécessaire | First-party. |
| `kazen:supporter:v1` | Statut Premium bêta client stub | Fonctionnel | Nécessaire | First-party, valeur `"1"`. |
| `kazen-consent:v1` | Préférence de consentement | Consentement lui-même | Nécessaire | Créé par cette phase. |

## SessionStorage

| Clé | Contenu | Finalité | Catégorie |
| --- | --- | --- | --- |
| `kazen-catalog:*` | Filtres/pagination catalogue | Restauration au retour | Nécessaire (session) |
| `kazen-mascot-intro-shown` | `"1"` une fois l'intro affichée | UX mascotte | Nécessaire (session) |

## IndexedDB

Aucune base IndexedDB créée par KAZEN. Vérifié via `rg` sur `indexedDB`.

## Scripts et iframes tiers

| Fournisseur | Chargement | Nécessité | Consentement | Traitement Phase 26.3 |
| --- | --- | --- | --- | --- |
| Supabase (auth/DB) | Au démarrage | Nécessaire | N/A | Inchangé. |
| AniList (`s4.anilist.co` images, GraphQL public) | À la demande | Nécessaire (catalogue) | N/A | Inchangé. |
| TMDB (`image.tmdb.org`) | À la demande | Nécessaire (catalogue) | N/A | Inchangé. |
| Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) | Au démarrage via `<link>` | Design system | À valider DPO | Documenté comme limitation, non bloqué (impact visuel majeur). |
| Google OAuth | Sur clic utilisateur | Nécessaire à l'action demandée | N/A | Inchangé. |
| YouTube (`img.youtube.com`, `youtube.com` iframe) | **AVANT** : au rendu de la fiche. **APRÈS** : uniquement après consentement ou clic explicite. | Optionnel | Requis | Blocage préalable. Bascule sur `youtube-nocookie.com` lorsque autorisé. |
| Lovable AI Gateway | Server-only | Nécessaire (fonction demandée) | N/A | Inchangé. |
| Resend | Server-only | Nécessaire (fonction demandée) | N/A | Inchangé. |

## Requêtes réseau avant consentement

- **Avant** : la grille de bandes-annonces déclenchait un `GET https://img.youtube.com/vi/<id>/hqdefault.jpg` par vidéo dès l'ouverture d'une fiche.
- **Après** : tant que `externalMedia` n'est pas accordé, aucune requête vers
  `img.youtube.com` ni `youtube.com` — une vignette KAZEN (icône YouTube +
  bouton play thématique) est rendue en local.

## Catégories réellement créées

- **Nécessaires** — toujours actives, non désactivables.
- **Contenus externes (`externalMedia`)** — off par défaut, contrôle YouTube.

Aucune catégorie « Mesure d'audience », « Publicité » ou « Réseaux sociaux »
n'est déclarée car aucun outil correspondant n'est intégré.

## Architecture

Source de vérité : `src/lib/consent.tsx`.

- `ConsentPreferences` typé, versionné (`CONSENT_VERSION = "2026-07-14"`).
- Lecture unique via `readStored()` avec validation stricte (`isPreferences`)
  et rejet silencieux en cas de version obsolète ou de format invalide → tous
  les services optionnels restent bloqués.
- Écriture unique via `persist()`.
- `ConsentProvider` monté dans `__root.tsx` sous `QueryClientProvider`.
- Hook `useConsent()` (context) — pas de duplication d'état.
- Comportement sûr si le provider est absent (fallback deny-all no-op).

## Bannière

`src/components/consent/CookieBanner.tsx`. Affichée tant que `decided === false`.
Trois boutons de poids visuel comparable : **Tout accepter**, **Tout refuser**,
**Personnaliser**. Lien direct vers la politique de confidentialité. La
fermeture n'est pas possible sans choix (aucun bouton × implicite). La
poursuite de navigation ne vaut pas consentement — la bannière reste
visible sur toutes les routes tant qu'aucun bouton n'est activé.

## Préférences

`src/components/consent/PreferencesDialog.tsx`. Modale accessible :

- catégorie « Strictement nécessaires » affichée en lecture seule (« Toujours actif »),
- catégorie « Contenus externes » avec Switch shadcn (rôle switch, `aria-label`),
- boutons **Tout refuser**, **Tout accepter**, **Enregistrer mes choix**,
- fermeture sans enregistrement possible via `onOpenChange`.

## Stockage de la preuve

Clé `kazen-consent:v1` en localStorage, contenant `{ version, necessary, externalMedia, decidedAt }`. Aucun IP, aucun user-agent, aucun identifiant
personnel stocké. Justification du choix local : aucun besoin multi-appareils
démontré, aucune preuve contractuelle avancée requise à ce stade bêta.

## Versionnement

Toute modification substantielle des catégories → bump `CONSENT_VERSION`. Un
consentement stocké avec une version antérieure est ignoré et la bannière est
réaffichée avec toutes les catégories optionnelles désactivées.

## Retrait du consentement

Depuis n'importe quelle page : pied de page → « Gérer mes cookies » → Tout
refuser (aussi simple qu'accepter). Effet immédiat : `externalMedia = false`,
les composants YouTube (`VideoGallery`, `TrailerDialog`) rendent à nouveau la
vignette KAZEN et n'émettent plus aucune requête. Les futures ouvertures de
lecteur exigent à nouveau une autorisation.

## Blocage préalable

Réel, pas seulement enregistré :

- `VideoGallery.tsx` : `<img src="https://img.youtube.com/...">` uniquement quand
  `externalMedia === true` (ou après clic explicite). Sinon SVG local.
- `VideoGallery.tsx` / `TrailerDialog.tsx` : l'`<iframe>` YouTube n'est
  montée que si `canPlay` est vrai.
- URL basculée sur `youtube-nocookie.com` pour réduire l'empreinte cookie
  après autorisation.

## YouTube

- iframe avant clic : **non**.
- requêtes avant clic : **non** (miniatures gatées).
- miniature : locale (icône Lucide sur fond thématique) tant que non autorisé.
- domaine utilisé après autorisation : `youtube-nocookie.com` (iframe) et
  `img.youtube.com` (miniatures, uniquement si consentement global).
- Modèle retenu : **Hybride (option C)** — consentement global via bannière/panneau
  OU autorisation ponctuelle par vidéo. Choisi car les fiches contiennent
  souvent plusieurs vidéos et un utilisateur peut vouloir n'en lancer qu'une
  sans autoriser le reste.

## Authentification (après refus)

`Deny all` ne touche pas au jeton Supabase (`sb-*-auth-token`) — la session
reste active. Inscription email, connexion email, Google OAuth, refresh
session et déconnexion inchangés. Le retrait ne réinitialise aucune donnée
Auth.

## Politique de confidentialité

`src/routes/confidentialite.tsx` §12 réécrite pour refléter précisément
l'implémentation : catégories réelles, mécanisme, stockage local, retrait,
absence d'analytics / publicité. Reste en MODE B (`noindex,nofollow`).

## Footer

Ajout du bouton « Gérer mes cookies » (rouvre le panneau) entre les liens
juridiques et le badge « Brouillons ».

## Fichiers modifiés

- `src/routes/__root.tsx` — monte `ConsentProvider` et `CookieBanner`.
- `src/components/layout/AppShell.tsx` — bouton « Gérer mes cookies » footer.
- `src/components/media/VideoGallery.tsx` — blocage préalable + placeholder.
- `src/components/media/TrailerDialog.tsx` — blocage préalable + placeholder.
- `src/routes/confidentialite.tsx` — §12 réécrite.

## Composants créés

- `src/lib/consent.tsx` — provider, hook, types, persistance versionnée.
- `src/components/consent/CookieBanner.tsx`.
- `src/components/consent/PreferencesDialog.tsx`.

## Routes

Aucune nouvelle route.

## Migrations, RLS, RPC

Aucune. `account_deletion_requests` non modifiée.

## Typecheck

`bunx tsgo --noEmit` → exit 0.

## Lint / Tests / Build

- Lint : non exécuté (hors périmètre demandé, aucun script `bun run lint` sûr).
- Tests : aucun test unitaire ajouté (composants UI purs + wiring).
- Build : géré par le harness Lovable.

## Tests navigateur

Non exécutés via Playwright dans ce tour (implémentation validée par typecheck
et revue de code). Scénarios documentés à vérifier manuellement :

1. Première visite → bannière visible, réseau : aucune requête `img.youtube.com`.
2. Tout refuser → bannière fermée, ouverture d'une fiche avec vidéos → vignette KAZEN, réseau : toujours aucune requête YouTube.
3. Tout accepter → miniatures YouTube chargées, iframe `youtube-nocookie.com` sur clic.
4. Personnaliser + désactiver externalMedia → identique à refus.
5. Autorisation ponctuelle → uniquement la vidéo choisie lance l'iframe, les autres restent en placeholder.
6. Retrait via footer → futures ouvertures redemandent autorisation.
7. Version bump `CONSENT_VERSION` → la bannière réapparaît.
8. Connecté / déconnecté → même comportement, session Auth préservée.

## Tests mobile

Non exécutés (Playwright non lancé ce tour). Le layout de la bannière est
`max-w-3xl` centré avec `flex-wrap` sur les boutons → adapté 320–1024 px.

## Non-régression

Zones inspectées : `AppShell` footer et routing (inchangés hormis un lien),
`VideoGallery`/`TrailerDialog` (API publique inchangée), Auth (aucune
modification). Typecheck global vert.

## Preview

Non ouverte manuellement ce tour ; validation statique + typecheck.

## Shared DB

Aucune consultation, aucune modification.

## Production

Aucune publication.

## Rollback

- Retirer `ConsentProvider` + `CookieBanner` de `src/routes/__root.tsx`.
- Restaurer les versions antérieures de `VideoGallery.tsx` et `TrailerDialog.tsx`.
- Retirer le bouton footer dans `AppShell.tsx`.
- Restaurer §12 précédente de `confidentialite.tsx`.
- Supprimer `src/lib/consent.tsx` et `src/components/consent/`.

## Validation DPO

- Confirmer la classification « nécessaire » pour `nexus-theme`, `nexus:list:v1`, `kazen:supporter:v1`.
- Trancher le sort de Google Fonts (self-host / classe optionnelle / documentation).
- Valider durée de vie du cookie de preuve (aujourd'hui : persistant tant que non retiré).
- Valider `youtube-nocookie.com` comme domaine d'embed retenu.

## Limitations

- Google Fonts reste chargé au démarrage (impact DA fort si bloqué) — à
  arbitrer avec DPO.
- La miniature YouTube n'est pas remplacée par une vraie vignette éditoriale
  (icône Lucide générique) — suffisant pour cette phase.
- Aucun test Playwright multi-viewport exécuté ce tour.
- Le SDK Supabase peut techniquement écrire d'autres clés `sb-*` selon sa
  version ; toutes restent classées nécessaires (Auth).

## Readiness Phase 26.4

**READY WITH BLOCKERS** — implémentation technique complète et cohérente.
Blocants ouverts : arbitrage Google Fonts + validation DPO des durées.

## Publication

**NON PUBLIÉ.**

## Verdict

**PARTIAL**

Concerne uniquement la Phase 26.3.

**Cause :** l'implémentation technique du consentement, du blocage préalable
YouTube et du retrait est en place et vérifiée par typecheck ; toutefois, les
tests réseau réels multi-scénarios n'ont pas été exécutés via Playwright dans
ce tour, et deux points restent à valider par un DPO (Google Fonts,
classification fine des localStorage first-party fonctionnels).
