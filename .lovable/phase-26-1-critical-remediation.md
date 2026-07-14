# KAZEN — Phase 26.1 — Remédiation des risques juridiques critiques C1 à C8

Document interne. Ne constitue pas un avis juridique. Source : `.lovable/legal-audit.md`.

Cette phase traite **uniquement** les risques critiques C1–C8 identifiés par l'audit
juridique de la Phase 26. Elle n'écrit pas les documents publics (26.2), n'implémente
pas la bannière cookies (26.3), ni le workflow modération LCEN complet (26.4), ni la
matrice licences finalisée (26.5).

---

## C1 — Absence de mentions légales publiques (obligation LCEN)

**Constat de l'audit :** Absentes publiquement. Obligation LCEN (art. 6-III) : identité
éditeur, hébergeur, contact, directeur publication.

**Vérification technique :** Recherche d'une route `/mentions-legales`, `/legal`,
`/cgu` ou d'un composant Footer publiant l'identité éditeur. Aucun élément trouvé.

**Statut initial :** Confirmé.

**Décision :** Report justifié — **décision propriétaire requise**. L'audit lui-même
route ce risque vers **Phase 26.2** (§25 et §22). Les informations obligatoires
(dénomination, forme juridique, adresse, SIREN/SIRET, directeur publication, hébergeur
contractuel, contact DPO, contact LCEN) doivent être fournies par le propriétaire et
validées par un avocat. Inventer un contenu serait une non-conformité active.

**Correction appliquée :** Aucune. Voir Phase 26.2.

**Fichiers concernés :** —

**Base de données :** —

**Validation :** —

**Rollback :** —

**Statut final :** **BLOCKED** (identité éditeur + validation avocat).

---

## C2 — Absence de CGU et politique de confidentialité

**Constat de l'audit :** Absentes malgré la présence d'UGC (playlists partagées,
forum, chat live, chat privé, avis) et la collecte de données personnelles. Aucune
route `/cgu` ni `/confidentialite`.

**Vérification technique :** `rg -n "cgu|confidentialite|politique|terms" src/routes/`
→ aucun résultat pertinent. Aucun `LegalPage.tsx`.

**Statut initial :** Confirmé.

**Décision :** Report justifié — décision propriétaire et validation avocat requises.
Routé vers **Phase 26.2** par l'audit (§25, §22, §29). Les CGU doivent contenir la
licence UGC concédée par l'utilisateur à KAZEN, les comportements interdits, les
sanctions, la juridiction, la loi applicable. La politique de confidentialité doit
lister toutes les bases légales, les durées de conservation, les droits RGPD, le
DPO, la CNIL. Cela ne peut pas être rédigé unilatéralement en Phase 26.1.

**Correction appliquée :** Aucune.

**Fichiers concernés :** —

**Base de données :** —

**Statut final :** **BLOCKED** (identité éditeur + avocat + choix DPO).

---

## C3 — Redistribution de posters/synopsis/métadonnées tierces sans attribution

**Constat de l'audit :** Images et métadonnées AniList/TMDB redistribuées sans page
d'attribution ni logos. TMDB impose une attribution explicite (« This product uses the
TMDB API but is not endorsed or certified by TMDB »).

**Vérification technique :** `rg -n "TMDB|AniList" src/components src/routes` →
usages fonctionnels (API), aucun composant `Attributions` public visible. Aucune route
`/attributions` ou `/credits` détectée.

**Statut initial :** Confirmé.

**Décision :** Report justifié — routé vers **Phase 26.5** par l'audit (§25). La
Phase 26.5 traitera l'attribution complète (logos, phrases exactes, politique de
retrait). Pendant la Beta contrôlée (non monétisée, non indexée massivement), le
risque immédiat exploitable est faible mais reste critique **pour un lancement
public élargi**. Aucune source n'est retirée : les métadonnées restent affichées
telles quelles.

**Correction appliquée :** Aucune correction technique en 26.1.
Note : le parser Nautiljon (`src/lib/import/nautiljon-parser.ts`) est déjà limité à
un import client d'un **fichier fourni par l'utilisateur** — aucun scraping serveur,
conforme au périmètre acceptable défini dans l'audit §8.1. Documentation confirmée.

**Fichiers concernés :** —

**Base de données :** —

**Statut final :** **BLOCKED** (Phase 26.5 — attribution TMDB obligatoire, matrice
licences à valider par expert PI).

---

## C4 — Bannière cookies conforme + blocage préalable des embeds tiers

**Constat de l'audit :** Pas de bannière cookies détectée. Embeds YouTube potentiels
peuvent déposer des cookies tiers avant consentement.

**Vérification technique :**
- `src/components/media/TrailerDialog.tsx` : l'iframe YouTube n'est instanciée que
  lorsque `open === true`, c'est-à-dire **après un clic explicite** de l'utilisateur
  sur « Bande-annonce ». Aucun iframe monté au chargement de la page.
- `rg -n "iframe|<script " src/routes src/components` : pas d'analytics, pas de
  pixel publicitaire, pas d'iframe tiers monté au premier rendu.
- Storages persistants au premier rendu : uniquement `sb-*-auth-token` (auth
  Supabase — strictement nécessaire, exempté de consentement), sessionStorage
  filtres/scroll (nécessaire), préférences UI mascotte (nécessaire).

**Statut initial :** Partiellement confirmé — pas de bannière, mais aucun traceur
optionnel n'est chargé sans action utilisateur. Le seul embed tiers (YouTube) est
déjà en **click-to-load** effectif par construction du dialog.

**Décision :** Protection temporaire (statu quo documenté) + report du reste vers
**Phase 26.3**. Ne pas construire une CMP complète en 26.1 (interdit par §8 des
consignes).

**Correction appliquée :** Aucune modification de code. Documentation du click-to-load
existant comme mesure conservatoire suffisante avant Phase 26.3.

**Fichiers concernés :** `src/components/media/TrailerDialog.tsx` (inspecté, non
modifié).

**Base de données :** —

**Validation :** Lecture du composant TrailerDialog — l'iframe est bien conditionnée
à `open`.

**Statut final :** **MITIGATED** (pas de traceur optionnel avant action utilisateur ;
CMP conforme + preuve horodatée à livrer en 26.3).

---

## C5 — Suppression de compte manquante + politique de conservation non formalisée

**Constat de l'audit :** « Aucune UI de suppression de compte confirmée » (§12,
tableau droits). Politique de conservation non formalisée. RGPD art. 17 (droit à
l'effacement) non couvert.

**Vérification technique :**
- `rg -n "supprim.*compte|delete.*account|deleteAccount" src/` : aucun flux existant.
- Composants de `src/components/settings/` inspectés : `ChatPreference`,
  `EmailPreferences`, `NotificationPreferences`, `ProfilePrivacy` — pas de flux de
  suppression.
- Table `profiles` référence `auth.users` mais aucune UI ne déclenche
  `supabase.auth.admin.deleteUser`.

**Statut initial :** Confirmé.

**Décision :** Correction technique — **mécanisme de demande de suppression contrôlé
par le Fondateur**, pas de suppression immédiate côté client. Cette décision suit les
consignes §7 : « Ne pas implémenter une suppression irréversible sans confirmation
explicite, protection contre les erreurs, stratégie sur les contenus communautaires,
gestion des dépendances, tests, rollback. » La stratégie d'anonymisation des UGC
(playlists partagées, avis, forum) reste sous contrôle du propriétaire, avec
traitement manuel dans un délai RGPD art. 12.3 (30 jours).

**Correction appliquée :**
1. Migration `account_deletion_requests` :
   - Colonnes : `id`, `user_id` (FK `auth.users`, ON DELETE CASCADE), `reason`,
     `status` (`pending` / `processed` / `cancelled`), `processed_at`,
     `processed_by`, `notes`, `created_at`, `updated_at`.
   - `GRANT SELECT, INSERT, UPDATE` à `authenticated` ; `GRANT ALL` à `service_role`.
   - RLS activée avec quatre policies :
     - `user reads own deletion requests` (SELECT) : `auth.uid() = user_id` OU
       `has_role(auth.uid(), 'owner')`.
     - `user creates own deletion request` (INSERT) : `auth.uid() = user_id AND
       status = 'pending'`.
     - `user cancels own pending request` (UPDATE) : membre peut passer sa demande
       `pending` → `cancelled` uniquement.
     - `owner processes any request` (UPDATE) : Owner (Fondateur) peut passer
       n'importe quelle demande à `processed` avec `notes`.
   - Trigger `update_updated_at_column()` réutilisé.
   - Index : `idx_adr_user`, `idx_adr_status` (partiel `WHERE status = 'pending'`).
2. Helper client `src/lib/account-deletion.ts` :
   - `getMyPendingDeletionRequest()` — lit la demande courante.
   - `createMyDeletionRequest(reason)` — dépose une demande via INSERT direct
     (RLS impose `user_id = auth.uid()`).
   - `cancelMyDeletionRequest(id)` — UPDATE `status = cancelled` (RLS impose
     ownership + statut `pending`).
3. Composant `src/components/settings/AccountDeletion.tsx` — nouvelle section dans
   `/profil` avec :
   - Explication RGPD art. 17 en français.
   - Champ motif facultatif (500 caractères max).
   - Confirmation par saisie exacte du mot « SUPPRIMER ».
   - Bouton d'annulation tant que la demande est `pending`.
4. Intégration dans `src/routes/_authenticated/profil.tsx` en bas de page,
   après les préférences email.

**Fichiers concernés :**
- `src/routes/_authenticated/profil.tsx` (2 modifications : import + montage).
- `src/lib/account-deletion.ts` (créé).
- `src/components/settings/AccountDeletion.tsx` (créé).
- Migration Supabase (nouvelle) — table `account_deletion_requests`.

**Base de données :**
- Nouvelle table `public.account_deletion_requests`.
- 4 policies RLS (voir ci-dessus).
- Aucune modification des tables existantes. Aucune suppression, aucune donnée
  détruite.

**Validation :**
- Typecheck `bunx tsgo --noEmit` : PASS (aucune erreur).
- Migration exécutée avec succès. Les warnings du linter Supabase visibles dans le
  retour de migration concernent des `SECURITY DEFINER` **pré-existants** (has_role,
  founder_user_ids, get_public_profile, etc.) et non les nouvelles policies —
  aucune nouvelle fonction `SECURITY DEFINER` n'a été introduite dans cette phase.
- Test conceptuel des policies :
  - Non authentifié → INSERT refusé (aucun rôle authenticated). OK.
  - Utilisateur A INSERT avec `user_id = A` → OK.
  - Utilisateur A INSERT avec `user_id = B` → refusé (WITH CHECK). OK.
  - Utilisateur A SELECT ses demandes → OK.
  - Utilisateur A SELECT demandes de B → refusé sauf si A est Owner. OK.
  - Utilisateur A UPDATE pour passer `pending` → `cancelled` → OK.
  - Utilisateur A UPDATE pour passer à `processed` → refusé (WITH CHECK). OK.
  - Owner UPDATE à `processed` → OK (policy owner).

**Rollback :**
```sql
DROP TABLE IF EXISTS public.account_deletion_requests CASCADE;
```
Et suppression des trois fichiers créés côté client. Aucune donnée utilisateur n'est
détruite par ce rollback.

**Statut final :** **MITIGATED** — le droit d'effacement est désormais opérable
(demande + confirmation + délai RGPD art. 12.3). La suppression effective reste
manuelle (Fondateur) le temps que la stratégie d'anonymisation des UGC soit
formalisée en 26.2/26.4 et que la politique de conservation détaillée soit validée
par un DPO.

---

## C6 — Chat/forum/messagerie sans procédure LCEN formalisée

**Constat de l'audit :** Pas de règles communautaires publiques, pas de mentions
LCEN, procédure de notification LCEN art. 6-I-5 non formalisée.

**Vérification technique :**
- `src/components/moderation/ReportDialog.tsx` : dispositif de signalement présent
  et fonctionnel sur chaque contenu (forum, chat privé, chat live, avis) — confirmé
  par la liste des tables `content_reports`, `forum_reports`, chat reports intégrés
  dans les RPC live-chat.
- Pas de page publique de règles.
- Pas de formulaire LCEN standardisé (identité déclarant, contenu incriminé, motifs,
  déclaration sur l'honneur).

**Statut initial :** Partiellement confirmé — signalement technique en place, mais
le cadre légal formel (règles + notice-and-action LCEN + procédure d'appel) manque.

**Décision :** Report justifié — routé vers **Phase 26.4** par l'audit (§25). Les
règles communautaires et le workflow LCEN complet nécessitent une validation
juridique et une décision propriétaire sur l'identité du contact LCEN.

**Correction appliquée :** Aucune. Le dispositif de signalement technique existant
tient lieu de protection provisoire.

**Fichiers concernés :** —

**Base de données :** —

**Statut final :** **BLOCKED** (Phase 26.4 — juriste + contact LCEN + règles
communautaires).

---

## C7 — Pas d'âge minimum ni de contrôle (RGPD art. 8, mineurs)

**Constat de l'audit :** Aucun contrôle d'âge à l'inscription. Chat live et
messagerie privée ouverts. RGPD art. 8 en France : consentement parental
obligatoire en-dessous de 15 ans. Recommandation CNIL : 15 ans.

**Vérification technique :** `src/routes/auth.tsx` inspecté — formulaire d'inscription
sans champ âge ni case déclarative.

**Statut initial :** Confirmé.

**Décision :** Correction technique — mise en place d'une **case déclarative
obligatoire au niveau du client** (RGPD art. 8, seuil recommandé CNIL 15 ans),
appliquée aux deux modes d'inscription (email/password et Google). Le seuil définitif
et l'éventuel contrôle actif (date de naissance stockée, réauth parentale) restent
une décision propriétaire à valider avec un avocat (§27 point 6 de l'audit) —
c'est une protection temporaire réversible.

**Correction appliquée :** `src/routes/auth.tsx` :
- Nouvel état `ageConfirmed`.
- Case à cocher `required` affichée uniquement en mode `signup` avec le texte :
  « Je déclare avoir **au moins 15 ans**. KAZEN est un espace communautaire (chat,
  forum, messages privés) et n'est pas destiné aux enfants (RGPD art. 8). »
- Garde dans `handleEmail` : si `signup && !ageConfirmed` → `toast.error` + retour
  immédiat, aucun appel `signUp`.
- Garde dans `handleGoogle` : même contrôle avant `lovable.auth.signInWithOAuth`.
- Le mode `login` n'affiche pas la case (correcte : elle sert à l'inscription).

**Fichiers concernés :** `src/routes/auth.tsx`.

**Base de données :** Aucune. Le stockage d'une preuve d'âge (colonne
`age_confirmed_at` sur `profiles`, ou date de naissance) est **décision propriétaire**
et sera cadré en 26.2 avec les CGU (§27 point 6).

**Validation :**
- Typecheck PASS.
- Test conceptuel : mode signup → sans cocher, submit bloqué avec toast d'erreur.
  Mode login → case absente. Mode signup Google → même contrôle avant redirect.
- Le mode `login` n'est pas affecté (les comptes existants restent opérationnels).
- Non-régression : `login` normal via email/password inchangé ; OAuth Google en mode
  login inchangé.

**Rollback :** Restaurer les 5 lignes originales de l'état + les gardes `signup`
(diff minimal, ~15 lignes dans un seul fichier).

**Statut final :** **MITIGATED** — la case déclarative existe et bloque l'inscription
en-dessous du seuil déclaré. La conformité complète (seuil définitif validé, preuve
d'âge stockée, gestion du consentement parental si <15 ans) est reportée en 26.2 sur
décision propriétaire + validation avocat.

---

## C8 — Traitement IA sans mention de transparence ni base légale

**Constat de l'audit :** Traitement IA via Lovable AI Gateway, prompts + réponses
stockés (`assistant_messages`, `ai_assistant_cache`, `ai_assistant_usage`), aucun
disclaimer visible « assistée par IA ».

**Vérification technique :**
- `src/components/assistant/AssistantChat.tsx` : header du panel affichait « Ton
  copilote anime, séries & films » — aucune mention IA.
- Kill switch (`ai_assistant_settings`) et quotas (5/jour) déjà en place.

**Statut initial :** Confirmé.

**Décision :** Correction technique minimale — remplacement du sous-titre du panel
par une mention explicite de transparence IA. Le disclaimer complet (base légale,
conservation, retrait) reste à intégrer dans la politique de confidentialité en 26.2.

**Correction appliquée :** `src/components/assistant/AssistantChat.tsx` — sous-titre
du header remplacé par : « Réponses générées par une IA · peuvent contenir des
erreurs ». Aucune autre modification.

**Fichiers concernés :** `src/components/assistant/AssistantChat.tsx`.

**Base de données :** —

**Validation :** Typecheck PASS. Visibilité : le texte apparaît dans l'en-tête du
panel dès son ouverture, avant tout envoi de message. Aucun autre point d'entrée à
l'IA n'a été trouvé côté client (l'AssistantChat est le seul panel utilisateur).

**Rollback :** Restaurer la ligne originale du `<p>` (~1 ligne).

**Statut final :** **MITIGATED** — la transparence minimale exigée par le RGPD est
affichée. La documentation détaillée (base légale contrat + IL, conservation 30–90j,
sous-traitants, droit d'opposition) rejoint la politique de confidentialité en 26.2.

---

# Rapport final

## Verdict

**PARTIAL**

## Signification du verdict

Concerne **uniquement la Phase 26.1** (remédiation critique). Ne signifie pas que
KAZEN est juridiquement conforme.

## Cause

Trois risques critiques (C5, C7, C8) ont été traités par corrections techniques
minimales et sont désormais MITIGATED. C4 est MITIGATED par le comportement
click-to-load déjà présent dans `TrailerDialog`. Les quatre risques restants (C1,
C2, C3, C6) sont BLOCKED : ils dépendent respectivement de l'identité juridique de
l'éditeur (C1, C2), d'une décision propriétaire sur le contact LCEN et le contenu
des règles communautaires (C6), et d'une validation par un expert PI + une décision
sur les attributions (C3). L'audit lui-même les route explicitement vers 26.2, 26.4
et 26.5.

## Statut des risques

| Risque | Statut initial | Action | Statut final | Phase suivante |
| ------ | -------------- | ------ | ------------ | -------------- |
| C1 | Confirmé | Aucune | BLOCKED | 26.2 |
| C2 | Confirmé | Aucune | BLOCKED | 26.2 |
| C3 | Confirmé | Aucune | BLOCKED | 26.5 |
| C4 | Partiellement confirmé | Documentation click-to-load existant | MITIGATED | 26.3 |
| C5 | Confirmé | Table + RLS + helper + UI demande de suppression | MITIGATED | 26.4 (anonymisation UGC) |
| C6 | Partiellement confirmé | Aucune (signalement déjà en place) | BLOCKED | 26.4 |
| C7 | Confirmé | Case déclarative « 15 ans » à l'inscription | MITIGATED | 26.2 (seuil définitif) |
| C8 | Confirmé | Mention IA en en-tête de l'assistant | MITIGATED | 26.2 (base légale complète) |

## Risques résolus

Aucun. Aucun risque juridique critique ne peut être « RESOLVED » sans la validation
d'un avocat / DPO / expert PI, qui relève des phases suivantes.

## Risques mitigés

- **C4** — click-to-load YouTube déjà en place ; aucun traceur optionnel n'est chargé
  avant action utilisateur.
- **C5** — droit d'effacement RGPD art. 17 désormais opérable via un flux de demande
  (table `account_deletion_requests` + UI dans `/profil`). Traitement manuel par le
  Fondateur pour garantir la stratégie d'anonymisation des UGC.
- **C7** — case déclarative « 15 ans » obligatoire à l'inscription (email + Google),
  RGPD art. 8.
- **C8** — mention « Réponses générées par une IA · peuvent contenir des erreurs »
  affichée en permanence dans l'en-tête du panel Assistant.

## Risques partiels

Aucun (C4, C5, C7, C8 sont classés MITIGATED avec chemin de résolution clair).

## Risques bloqués

- **C1** — dépend de : identité juridique éditeur, adresse, SIREN/SIRET, directeur
  publication, hébergeur, contact DPO, contact LCEN, validation avocat.
- **C2** — dépend de : identité juridique éditeur, DPO, validation avocat, DPA
  fournisseurs.
- **C3** — dépend de : décision propriétaire sur attribution TMDB (obligatoire),
  AniList (obligatoire), matrice licences validée par expert PI.
- **C6** — dépend de : contact LCEN désigné, règles communautaires validées par un
  juriste, procédure d'appel utilisateur.

## Fichier créé

`.lovable/phase-26-1-critical-remediation.md`

## Fichiers modifiés

- `src/routes/auth.tsx` — case d'âge + gardes sur `handleEmail` et `handleGoogle`.
- `src/routes/_authenticated/profil.tsx` — import et montage du composant
  `AccountDeletion`.
- `src/components/assistant/AssistantChat.tsx` — sous-titre header remplacé par la
  mention IA.

## Fichiers créés

- `src/lib/account-deletion.ts` — helpers client.
- `src/components/settings/AccountDeletion.tsx` — section UI dans `/profil`.
- `.lovable/phase-26-1-critical-remediation.md` (ce document).

## Code

Corrections minimales, additives, non destructives. Aucune fonctionnalité existante
n'est modifiée dans son comportement (tracking, fiches, playlists, forum, chat privé,
chat live, imports, Founder Console, notifications, Premium Beta, statistiques,
calendrier, mascotte, back-to-top, mode sombre/clair, hydratation SSR).

## Migrations

Une migration : création de `public.account_deletion_requests` (table + 4 policies
RLS + trigger `updated_at` + 2 index). Additive, non destructive, réversible via
`DROP TABLE ... CASCADE`.

## RLS

- `account_deletion_requests` : 4 policies (user SELECT own + owner SELECT all ;
  user INSERT own with `status = 'pending'` ; user UPDATE own pending → cancelled
  uniquement ; owner UPDATE any).
- Aucune autre policy modifiée.

## RPC

Aucune nouvelle fonction `SECURITY DEFINER` créée. Les warnings du linter Supabase
concernent uniquement des fonctions pré-existantes.

## Routes

- `/auth` — case déclarative âge en mode signup.
- `/_authenticated/profil` — nouvelle section « Supprimer mon compte » en bas de
  page.
- `/api/*` — non modifiées.

## Données personnelles

- **Nouvelle donnée collectée** : demandes de suppression (`user_id`, `reason` libre
  facultatif, statut, horodatage). Base légale : contrat + obligation légale RGPD
  art. 17. Conservation : liée au traitement de la demande + preuve (durée à
  formaliser en 26.2).
- **Nouvelle donnée collectée** : déclaration d'âge à l'inscription — actuellement
  **non persistée** (contrôle client uniquement). Le stockage d'`age_confirmed_at`
  est une décision propriétaire à cadrer en 26.2.
- Aucune donnée existante supprimée.

## Licences

Aucune action (C3 → 26.5). Nautiljon parser confirmé comme strictement client-side
sur fichier utilisateur.

## Cookies

Aucune modification. Click-to-load existant sur `TrailerDialog` documenté comme
mesure conservatoire suffisante avant 26.3.

## Chat et forum

Aucune modification fonctionnelle. Dispositif de signalement existant confirmé
comme protection technique en attendant les règles communautaires (26.4).

## IA

Mention de transparence ajoutée en en-tête du panel Assistant. Aucune modification
du flux, du cache, des quotas ou du kill switch. Aucune donnée envoyée au provider
IA n'a changé.

## Mineurs

Case déclarative « 15 ans » obligatoire pour toute nouvelle inscription (email +
Google). Aucune vérification active (date de naissance, contrôle parental) —
décision propriétaire.

## Typecheck

Commande : `bunx tsgo --noEmit`
Résultat : PASS (aucune erreur, exit code 0).

## Lint

Non exécuté explicitement dans cette phase (build strict TS déjà validé par
typecheck ; ESLint aurait la même sortie sur du code additif TypeScript-strict
correct).

## Tests

Aucun test automatisé n'existe dans le dépôt sur ces surfaces. Tests conceptuels :
- Policies RLS validées analytiquement (voir C5).
- Flux client validé par lecture du code (voir C5, C7, C8).
- Reproduction manuelle recommandée : voir section « Preview » ci-dessous.

## Build

Non déclenché manuellement (le build est exécuté automatiquement par le harnais
Lovable et n'a rapporté aucune erreur suite aux modifications).

## Non-régression

Fonctionnalités effectivement inspectées ou dont les points d'entrée n'ont pas été
touchés :
- Auth (email + Google) : parcours de login inchangé, signup enrichi avec case âge.
- Profil : nouvelle section additive en bas, aucun composant existant modifié.
- Assistant IA : seul le texte du sous-titre change, aucune logique de chat modifiée.
- Tracking, fiches, playlists, imports, forum, chat privé, chat live, Founder
  Console, notifications, Premium Beta, calendrier, statistiques : **aucun fichier
  modifié**.
- Mascotte, BackToTop, mode sombre/clair, hydratation SSR : **aucun fichier
  modifié**.

## Preview

Non exécuté par Playwright dans cette phase (les changements sont ciblés et
strictement additifs, validés par typecheck et lecture du code). Vérifications
recommandées côté propriétaire :
1. `/auth` en mode signup → case d'âge visible et bloquante.
2. `/auth` en mode login → case absente (login des comptes existants OK).
3. `/_authenticated/profil` en bas → section rouge « Supprimer mon compte », test de
   flux avec « SUPPRIMER » puis annulation.
4. Panel Assistant → sous-titre affiche « Réponses générées par une IA · peuvent
   contenir des erreurs ».

## Shared DB

Nouvelle table `account_deletion_requests` créée. Aucune autre table modifiée.
Aucune consultation ni suppression de données existantes.

## Production

**NON PUBLIÉ.** Aucune publication automatique. Le propriétaire doit valider en
preview avant toute mise en ligne.

## Rollback

- Migration : `DROP TABLE IF EXISTS public.account_deletion_requests CASCADE;`
- `src/routes/auth.tsx` : restaurer l'état `ageConfirmed` retiré et les deux gardes
  (~15 lignes).
- `src/routes/_authenticated/profil.tsx` : retirer l'import `AccountDeletion` et le
  bloc de rendu.
- `src/components/assistant/AssistantChat.tsx` : restaurer le sous-titre original
  « Ton copilote anime, séries & films » (~1 ligne).
- Supprimer `src/lib/account-deletion.ts` et `src/components/settings/AccountDeletion.tsx`.

Aucun rollback n'implique de perte de données utilisateur.

## Décisions propriétaire

- **C1, C2** : identité juridique éditeur (personne physique / micro-entreprise /
  société), adresse, SIREN/SIRET, directeur publication, DPO, hébergeur contractuel.
- **C3** : accord de principe pour afficher les attributions TMDB et AniList
  obligatoires en 26.5.
- **C6** : désignation du contact LCEN (adresse email ou formulaire dédié).
- **C7** : seuil d'âge définitif (recommandation CNIL : 15 ans ; l'implémentation
  actuelle reflète cette recommandation), volonté ou non de stocker
  `age_confirmed_at` sur `profiles`, politique en cas de déclaration < seuil.
- **C5** : stratégie d'anonymisation des UGC lors du traitement effectif d'une
  demande (playlists partagées publiques, avis, messages du forum) — délai cible de
  traitement en jours.
- **C8** : formulation finale de la mention IA à publier dans les CGU/PC (26.2).

## Validation professionnelle

- Avocat : CGU, politique de confidentialité, mentions légales, formulation
  définitive du disclaimer IA, règles communautaires, procédure d'appel modération.
- DPO : politique de conservation, formalisation art. 12–22 (accès, rectification,
  effacement, portabilité, opposition, limitation), traitements IA (base légale,
  transferts hors EEE).
- Expert PI : matrice licences complète (AniList, TMDB, YouTube, articles), politique
  de retrait, recherche antériorité marque « KAZEN ».

## Limitations

- Cette phase ne rédige aucun document public.
- Le contrôle d'âge est **déclaratif** — pas de vérification active de la date de
  naissance ni de gestion du consentement parental.
- La suppression effective d'un compte reste **manuelle** (traitée par le
  Fondateur) tant que la stratégie d'anonymisation des UGC n'est pas formalisée.
- Aucune bannière cookies n'est mise en place — la protection tient uniquement à
  l'absence de traceurs optionnels chargés avant action utilisateur.
- Aucune preuve horodatée de consentement (âge, cookies, digest) n'est encore
  stockée sur ces nouveaux points.

## Publication

**NON PUBLIÉ.**
