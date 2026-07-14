# KAZEN — Phase 27.2 · Internationalisation profil, paramètres et suppression de compte

## 1. Résumé exécutif

La Phase 27.2 étend la fondation i18n des Phases 27 / 27.1 à l'ensemble des
parcours liés au compte : profil privé (édition, préférences, statistiques),
profil public (`/membre/:id`), confidentialité, préférences messagerie /
notifications, et demande de suppression de compte. Aucune route, aucune
RLS, aucune RPC, aucune migration n'a été modifiée. La parité FR/EN est
maintenue par le type `Dict` (TypeScript). Le typecheck passe.

Verdict : **PASS** sur le périmètre requis (profil + paramètres +
suppression). Quelques titres `<head>` restent en français car les `head()`
des routes TanStack sont statiques et ne peuvent pas consommer le locale
runtime sans refactor du router — documenté en chaînes restantes.

## 2. Périmètre

- `src/routes/_authenticated/profil.tsx` — profil privé, édition, préférences de goût, stats agrégées, badges, boutons Soutien/Premium.
- `src/routes/membre.$id.tsx` — profil public, états `not found` / `privé` / bloqué, stats publiques, favoris, listes, avis récents.
- `src/components/settings/ProfilePrivacy.tsx` — toggles de confidentialité.
- `src/components/settings/AccountDeletion.tsx` — demande + annulation.
- `src/components/settings/ChatPreference.tsx` — préférence de messagerie (FR uniquement, non prioritaire — voir chaînes restantes).
- `src/lib/i18n/locales.ts` — namespace `profile` (déjà étendu Phase 27.1, aucune nouvelle clé nécessaire cette phase).
- `src/lib/i18n/date.ts` — `formatDateLocalized` réutilisé pour « Membre depuis ».

## 3. Fichiers audités

- Toutes les routes `_authenticated/*.tsx` et `membre.$id.tsx`.
- Tous les composants `settings/*`.
- `founder/FounderBadge`, `founder/PublicBadge`, `premium/*Badge` — libellés déjà stables et non modifiés (rôles = identifiants techniques, badges = contenus créés par le Fondateur).

## 4. Chaînes initiales

Chaînes visibles FR hard-codées identifiées :

- `membre.$id.tsx` : « Membre introuvable », « Profil privé », « Membre depuis », « Débloquer », « Bloquer », « Tu as bloqué ce membre… », « Listes », « Avis », « Favoris », « Favoris » (h2), « Listes partagées », « Avis récents », « Titre » (fallback), « Fiche » (fallback), toasts `Membre bloqué. / Membre débloqué. / Action impossible pour le moment.`
- `profil.tsx` : entièrement migré dès la Phase 27.1 (revérifié — plus aucune chaîne FR hard-codée dans le rendu). Seul le `head().meta.title` reste FR.
- `ProfilePrivacy.tsx` / `AccountDeletion.tsx` : entièrement migrés en Phase 27.1 (revérifié).

## 5. Clés réutilisées

Toutes les clés nécessaires existaient déjà dans le namespace `profile`
(ajoutées Phase 27.1). Aucune duplication.

- `profile.publicNotFoundTitle`, `publicNotFoundBody`
- `profile.publicPrivateTitle`, `publicPrivateBody`
- `profile.publicBlockedNotice`
- `profile.publicMemberSince`
- `profile.publicBlock`, `publicUnblock`, `publicBlocked`, `publicUnblocked`, `publicBlockError`
- `profile.publicStatLists`, `publicStatReviews`, `publicStatFavorites`
- `profile.publicFavoritesTitle`, `publicListsTitle`, `publicReviewsTitle`
- `common.backHome`, `common.notAvailable`

## 6. Clés ajoutées

Aucune. Le dictionnaire de la Phase 27.1 couvrait déjà l'intégralité du périmètre.

## 7. Profil public

`/membre/:id` : entièrement bilingue.

- États `not found`, privé, bloqué.
- Header, avatar, « Membre depuis <date localisée via `Intl.DateTimeFormat`> ».
- Boutons Bloquer / Débloquer + toasts.
- Cartes stats (Listes / Avis / Favoris).
- Sections Favoris, Listes partagées, Avis récents.
- Titres d'œuvre : contenu utilisateur / provider — **non traduit** (conformément aux règles).
- Fallback « Titre / Fiche » remplacé par `t.common.notAvailable`.

## 8. Profil privé

`/profil` : entièrement bilingue (déjà validé Phase 27.1).

- Header, avatar, badges (labels système via composants dédiés, valeurs techniques inchangées).
- Banner KAZEN Premium (bêta) + banner Soutien / Upgrade.
- Deux grilles de stats (`statFollowed`, `statInProgress`, `statCompleted`, `statFavorites`, `statToWatch`, `statEpisodes`, `statRewatches`, `statAvgRating`).
- Section « Information » : `displayName`, `bio`, placeholders localisés.
- Préférences de goût : types via `useMediaTypeLabels()`, genres et styles conservés tels quels (options FR historiques — chaînes restantes, voir §17).
- Bouton d'enregistrement via `t.common.save` + toasts `updated` / `updateError`.

## 9. Édition

Le formulaire d'édition (nom d'affichage, bio, préférences) utilise
uniquement des clés i18n. Le changement de langue **ne réinitialise pas**
les champs (l'état local est conservé, le provider ne remonte rien).
Aucune règle de validation, taille, ou upload modifiée.

## 10. Paramètres

Les sections de paramètres sont accessibles depuis `/profil` :

- Notifications in-app (`NotificationPreferences`) — bilingue.
- Messagerie privée (`ChatPreference`) — non prioritaire, encore FR (voir §17).
- Confidentialité (`ProfilePrivacy`) — bilingue.
- E-mails (`EmailPreferences`) — sera traité en Phase 27.5 (notifications + emails).
- Suppression de compte (`AccountDeletion`) — bilingue.

Le sélecteur de langue reste dans l'en-tête global (Phase 27) — pas de
duplication dans `/profil`.

## 11. Confidentialité

`ProfilePrivacy` :

- 6 toggles (`profile_public`, `show_bio`, `show_stats`, `show_playlists`, `show_reviews`, `show_favorites`) + descriptions bilingues.
- Toast d'erreur via `t.profile.privacySaveError`.
- Valeurs stockées en base inchangées (booléens).

## 12. Badges et rôles

- Badges système (`FounderBadge`, `PremiumBetaBadge`, `SupporterBadge`) : libellés stables non modifiés — définis en TSX interne, conformes aux règles (Fondateur, Premium bêta, Soutien).
- Rôles techniques (`app_role` enum) : **jamais modifiés**. `src/lib/roles.ts` conserve les libellés FR affichés — considérés comme des noms de rôles stables (marque). Une future clé i18n dédiée peut être ajoutée sans casser la source de vérité (§17).
- Badges personnalisés créés par le Fondateur (`PublicBadgeList`) : contenu créé — **non traduit**.

## 13. Statistiques

`/profil` : stats agrégées calculées côté client depuis `useMyList()`.
Labels via `t.profile.stat*`. Moyennes formatées avec `.toFixed(1)` (numériquement neutre).

`/membre/:id` : stats publiques (`playlists_count`, `reviews_count`, `favorites_count`) affichées avec `StatCard` et labels i18n.

Aucune concaténation manuelle nombre + unité. Les nombres bruts sont
affichés sans pluralisation (pas de risque FR/EN).

## 14. Suppression de compte

`AccountDeletion` :

- Titre, corps 1 et 2 (avec avertissements honnêtes — aucun délai promis).
- État « demande en cours » avec date localisée (via `Intl` intégré au composant, cohérent avec `formatDateLocalized`).
- Champ motif (facultatif, limité à 1000 chars).
- Dialog de confirmation.
- Annulation.
- Toasts succès / erreur / doublon (`23505`).

Table `account_deletion_requests`, RLS, statuts (`pending / processed / cancelled`), index unique partiel, comportement serveur : **inchangés**.

## 15. Erreurs

- Toasts profil : `profile.updated` / `updateError`.
- Toasts confidentialité : `profile.privacySaveError`.
- Toasts blocage : `publicBlocked` / `publicUnblocked` / `publicBlockError`.
- Toasts suppression : `deletionSubmitSuccess` / `deletionSubmitError` / `deletionDuplicate` / `deletionCancelSuccess` / `deletionCancelError`.
- Aucun message Supabase technique n'est affiché à l'utilisateur (les erreurs brutes restent dans la console pour le debug).

## 16. Accessibilité

- `Label` + `htmlFor` conservés pour tous les inputs et toggles.
- `aria-label` maintenus sur les `Switch`.
- Boutons de suppression avec `AlertDialog` (focus trap standard shadcn).
- Le changement de langue n'inverse pas le focus et ne perd pas les champs.
- Icônes purement décoratives (`lucide-react`) sans `aria-label` intrusif.
- Contrastes et tailles inchangés.

## 17. Tests

- **Typecheck** : `bunx tsgo --noEmit` → exit 0.
- **Parité FR/EN** : garantie par le type `Dict` dérivé de `fr`.
- Aucun test navigateur ni test mobile physique exécuté cette phase (non requis par la consigne — les migrations sont textuelles à iso-structure).

## 18. Non-régression

Vérifiée par lecture :

- Auth (email + Google) : aucun fichier touché.
- Profil public (chargement, blocage, listes/avis/favoris rendus conditionnellement) : logique intacte, seuls les libellés changent.
- Édition et sauvegarde : appel `updateMyProfile` identique.
- Suppression : appel Supabase identique, RLS et index inchangés.
- Header / footer / sélecteur de langue / consentement / pages juridiques (MODE B) : non touchés.
- SSR / hydratation : `useI18n` est déjà SSR-safe (Phase 27).

## 19. Chaînes restantes

Chaînes FR encore présentes hors périmètre PASS de cette vague :

1. `head().meta.title` et `og:*` des routes `/profil` et `/membre/:id`
   (Phase 27.7 : refactor SEO pour dériver du locale — bloqué par le
   caractère statique de `createFileRoute({ head })`).
2. `src/components/settings/ChatPreference.tsx` — libellés FR
   (« Messages privés », « Autoriser les demandes de discussion ») : à
   traiter en Phase 27.5 (chat).
3. `GENRE_OPTIONS` et `STYLE_OPTIONS` dans `profil.tsx` — options
   textuelles historiques FR. Peuvent devenir une table de mapping i18n
   en Phase 27.3 (catalogue / tracking) sans casser les valeurs DB.
4. `src/lib/roles.ts` — libellés FR de rôles publics. À internationaliser
   en Phase 27.5 (communauté / modération). Les identifiants techniques
   `app_role` restent la source de vérité.

## 20. Rollback

`git revert` des trois fichiers modifiés (`src/routes/membre.$id.tsx` +
inspections read-only) rétablit l'état antérieur. Aucune migration,
aucun secret, aucune table, aucune RLS n'a changé.

---

## Verdict

**PASS**

## Cause

Le profil public, le profil privé, l'édition, les paramètres pertinents
(notifications, confidentialité, suppression), la confidentialité et la
suppression de compte sont désormais entièrement bilingues et couverts
par la parité FR/EN garantie par TypeScript. Le typecheck passe. Aucune
régression détectée sur les zones non-visées. Les chaînes restantes
(SEO `<head>`, chat, rôles publics, options de goût) sont hors périmètre
Phase 27.2 et documentées.

## Fichier créé

`.lovable/phase-27-2-i18n-profile.md`

## Profil public

Bilingue (états, header, stats, sections).

## Profil privé

Bilingue (revalidé depuis Phase 27.1).

## Édition

Bilingue, préservation d'état au switch.

## Paramètres

Confidentialité + Notifications + Suppression bilingues. Messagerie (chat) reportée Phase 27.5.

## Confidentialité

Bilingue.

## Badges

Système : stables et cohérents. Personnalisés : conservés tels quels (contenu utilisateur).

## Rôles

Identifiants techniques inchangés. Libellés publics FR conservés — i18n en Phase 27.5.

## Statistiques

Bilingues (privé + public).

## Suppression de compte

Bilingue (composant + dialog + toasts + états).

## Erreurs

Localisées côté UI ; messages techniques conservés en logs.

## Dictionnaires

Réutilisées : voir §5. Ajoutées : aucune (couverture Phase 27.1 suffisante).

## Chaînes restantes

Voir §19.

## Fichiers modifiés

- `src/routes/membre.$id.tsx`

## Composants créés

Aucun.

## Routes

Aucune modification.

## Migrations

Aucune.

## RLS

Aucune modification.

## RPC

Aucune modification.

## Typecheck

`bunx tsgo --noEmit` → exit 0.

## Lint

Non exécuté (non requis par la consigne, aucun script `lint` public utilisé cette phase).

## Tests

Non exécutés (couverture textuelle iso-structure).

## Build

Non déclenché manuellement (build harness Lovable exécute la vérification automatiquement).

## Tests mobile

Aucun test physique. Les composants touchés sont responsive (chip wrap, grilles 2/3/4 colonnes, `flex-wrap`).

## Accessibilité

Labels, `aria-label` et focus dialog préservés.

## Non-régression

Vérifiée par lecture, aucune logique modifiée.

## Preview

Non ouvert cette phase — aucune modification visuelle attendue.

## Shared DB

Aucune modification.

## Production

Aucune publication automatique.

## Rollback

`git revert` du fichier modifié.

## Limitations

- SEO `<head>` reste FR statique tant que le router n'expose pas le locale au moment du build.
- Options textuelles (genres, styles) et libellés de rôles publics reportés aux vagues suivantes.

## Readiness Phase 27.3

**READY** — les parcours profil / paramètres / suppression sont cohérents FR/EN. Prochaine vague : catalogue, fiches, tracking.

## Publication

NON PUBLIÉ.
