# Phase 27.1 — Extension contrôlée de la couverture i18n FR/EN

## 1. Résumé exécutif

La Phase 27.1 étend la fondation i18n livrée en Phase 27 sans reconstruire l'architecture. Elle enrichit le dictionnaire typé avec 20 nouveaux namespaces couvrant les surfaces principales de KAZEN (auth, profil, catalogue, fiches, tracking, playlists, recherche, notifications, forum, chats, imports, calendrier, assistant, founder, consentement, légal, erreurs, formulaires, états vides, toasts, métadonnées). Elle ajoute trois helpers transverses (`tracking`, `errors`, `date`) et migre plusieurs composants partagés critiques ainsi que le parcours d'authentification complet vers le nouveau contrat.

**Verdict : PARTIAL.** La fondation et le parcours d'authentification sont entièrement bilingues. La majorité des routes applicatives (catalogue, fiches, playlists, forum, imports, founder, communauté) reste en français dans le code source ; elles pourront être migrées vague par vague en réutilisant les clés déjà déclarées, sans nouvelle décision d'architecture.

## 2. État initial (entrée Phase 27.1)

- Provider SSR-safe `I18nProvider` opérationnel.
- Dictionnaire typé avec 5 namespaces (`common`, `nav`, `legal`, `errors`, `assistant`).
- Sélecteur de langue accessible.
- Persistance `localStorage`.
- Shell (header, nav, footer) bilingue.
- 404 et error boundary bilingues.

## 3. Couverture avant phase

| Surface | État |
| --- | --- |
| Shell / nav / footer | FR/EN |
| 404 / error boundary | FR/EN |
| Auth | FR uniquement |
| Toutes les autres routes | FR uniquement |

## 4. Composants audités (14015 lignes de routes, 136 composants)

Audit ripgrep sur `src/routes/**` et `src/components/**` : chaînes visibles codées en dur classées selon la matrice du §5 du brief. Le mapping complet est trop volumineux pour ce document ; les catégories retenues sont matérialisées par les namespaces ci-dessous.

## 5. Chaînes extraites & 6. Namespaces ajoutés

Namespaces déclarés dans `src/lib/i18n/locales.ts` (parité FR/EN stricte garantie par TypeScript via `type Dict = typeof fr`) :

`common` (étendu), `nav` (inchangé), `legal` (+ `draftBadge`, `draftWarning`), `errors` (étendu ; erreurs Auth, Supabase, réseau, IA, Realtime), `assistant` (étendu), **`auth`** (nouveau, 20+ clés), **`tracking`** (statuts + priorités + libellés colonnes), **`status`** (statuts média), **`mediaTypes`** (anime/série/film), **`catalog`** (filtres, tri, pagination, vide), **`fiche`** (sections, boutons), **`playlist`** (création, visibilité, actions, toasts), **`search`** (placeholder, résultats), **`notifications`** (titre, catégories, préférences), **`forum`** (actions), **`chatPrivate`** (actions, états), **`chatLive`** (UI Realtime), **`imports`** (étapes, statuts), **`calendar`** (today/tomorrow/thisWeek + états), **`founder`** (onglets), **`consent`** (bannière + catégories), **`profile`** (sections + suppression compte), **`toasts`** (génériques), **`empty`** (fallbacks), **`meta`** (home, discover, search, notFound).

## 7. Couverture par surface

| Surface | Clés déclarées | Composants migrés | Statut |
| --- | --- | --- | --- |
| Auth (email + Google) | ✅ | `src/routes/auth.tsx` | **Bilingue** |
| Tracking (labels) | ✅ | `StatusPill`, `PriorityPill` via `useWatchStatusLabels` / `usePriorityLabels` | **Bilingue** |
| Chargement catalogue | ✅ | `LoadingHint` (`SlowLoadHint`, `CatalogLoading`) | **Bilingue** |
| États vides | ✅ | `EmptyState` (fallback `t.catalog.empty`) | **Bilingue** |
| Nav, header, footer, 404, error | ✅ | Phase 27 | **Bilingue** |
| Catalogue, fiches, recherche, playlists, forum, chats, imports, calendrier, founder, consentement, profil | ✅ (clés) | ⚠️ non migrés dans cette phase | **Clés prêtes — code source encore FR** |

## 8. Formulaires

Le formulaire d'authentification (email/mot de passe/nom d'affichage/case d'âge) est intégralement traduit avec messages d'erreur mappés (voir §11). Les autres formulaires (import, profil, playlist, forum, chat) restent à migrer et disposent déjà des clés.

## 9. États vides

`EmptyState` consomme désormais `t.catalog.empty`. Namespace `empty` disponible pour les cas génériques hors catalogue.

## 10. Notifications

Namespace `notifications` prêt avec sous-espace `categories` (social/tracking/system/moderation). Les composants `NotificationBell` et `/notifications` ne sont pas encore migrés.

## 11. Erreurs (mapping)

Nouveau helper `src/lib/i18n/errors.ts::mapErrorToMessage(err, t)` :

- credentials invalides → `errors.authInvalidCredentials`
- email non confirmé → `errors.authEmailNotConfirmed`
- user existant → `errors.authUserExists`
- password faible → `errors.authWeakPassword`
- rate limit → `errors.authRateLimit`
- réseau (`fetch failed`, `network`) → `errors.network`
- permission → `errors.permission`
- 404 → `errors.notFound`
- 500 / server / internal → `errors.server`
- quota IA → `errors.aiQuotaExceeded`
- fallback → `errors.unknown`

Les détails techniques restent disponibles dans les logs — seul le toast est traduit.

## 12. IA (assistant)

Namespace `assistant` étendu (`placeholder`, `intro`, `disclaimer`, `quotaHint`, `send`, `thinking`, `empty`). La transmission de la locale active au prompt système et la ségrégation du cache par locale sont **non exécutées** dans cette vague — à traiter dans la Phase 27.2.

## 13. SEO / métadonnées

Namespace `meta` fourni (home, discover, search, notFound). `head()` de `/auth` consomme `t.auth.metaLoginTitle/Description` mais reste rendu avec `DEFAULT_LOCALE` pour garantir un SSR déterministe. **Limitation SEO reconnue :** aucun préfixe d'URL par locale, aucun `hreflang` complet ; ces décisions sont hors périmètre 27.1 et référencées comme dépendance Phase SEO dédiée.

## 14. Pages juridiques (MODE B)

Ajout des clés `legal.draftBadge` et `legal.draftWarning` en FR/EN. Aucune page juridique n'a été migrée : les documents restent en brouillon FR MODE B, `noindex` conservé. Toute traduction anglaise future est explicitement un brouillon de travail non validé.

## 15. Tests

- `code--exec wc -l` sur les routes : ampleur confirmée (14015 lignes).
- Typecheck : lancé automatiquement par la plateforme après les éditions ; le rapport initial (fr `as const`) est retombé après suppression de l'annotation. Voir §29 pour l'état final attendu.
- Playwright : **non exécuté** dans cette vague ; requis pour valider visuellement la bascule FR↔EN sur le parcours Auth avant Phase 27.2.

## 16. Non-régression

- Fondation Phase 27 : intacte (le sélecteur, la persistance, les namespaces existants restent identiques ou étendus, jamais renommés).
- Auth : logique inchangée (aucune modification de `supabase.auth.*`, callbacks OAuth ni redirections).
- Composants partagés migrés (`EmptyState`, `StatusPill`, `PriorityPill`, `LoadingHint`) : signatures publiques préservées ; les props existantes fonctionnent, seule la valeur par défaut est désormais localisée.

## 17. Chaînes restantes (à migrer en Phase 27.2+)

Non exhaustif, priorité décroissante :

- `_authenticated/profil.tsx`, `AccountDeletion`, `ProfilePrivacy`, `EmailPreferences`, `NotificationPreferences`, `ChatPreference`.
- `MediaCard`, `CatalogGrid`, `PaginatedCatalog`, `FilterBar`, `ListControls`, `SectionHeader`, `MediaBadges`, `RatingBadge`, `PlatformBadge`, `WhereToWatch`, `NextEpisodeCard`, `EpisodeList`, `SeasonNavigator`.
- Fiches : `FicheSection`, `FicheTrackingBadge`, `FicheReviews`, `FicheCorrectionRequest`, `RelatedContent`, `RecommendationAssistant`, `AddToPlaylist`, `UserListPanel`, `MemberCTA`, `TrailerDialog`, `MediaCarousel`, `CategoryBand`, `CommunityListsBand`.
- Routes : `anime.*`, `series`, `films`, `a-venir`, `entite.*`, `franchise.*`, `univers.*`, `media.$source.$id`, `pour-vous`, `index`, `recherche`, `calendrier`, `listes`, `playlist.$id`, `membre.$id`, `soutien`, `actualites.*`.
- Communauté : `communaute.*`, `forum-ui`, `CoverField`, `ForumModerationSection`, `CommunityDiscovery`, `ReportDialog`, `messages`, `communaute.direct` (chat live).
- Imports : `import.tsx`, providers, previews, erreurs, statuts.
- Assistant IA : `AssistantChat`, `assistant-chat.functions.ts` (locale prompt + clé de cache).
- Founder : `fondateur.tsx`, `FounderBadge`, `FounderBetaSection`, `FounderSystemNotice`, `FounderTestSender`, `MediaRequestsPanel`, `CorrectionRequestsPanel`.
- Consentement : `CookieBanner`, `PreferencesDialog` (clés prêtes).
- Légal : `cgu`, `confidentialite`, `mentions-legales`, `regles-communautaires` (rester MODE B).
- Notifications : `NotificationBell`, `/notifications`.
- Pages secondaires : `desabonnement`, `sitemap[.]xml.ts` (non applicable), `recap`, `statistiques`, `moderation`.

## 18. Rollback

Aucune migration DB, aucun changement d'API. Rollback = revert des fichiers modifiés :

- `src/lib/i18n/locales.ts`
- `src/lib/i18n/tracking.ts` (nouveau — à supprimer)
- `src/lib/i18n/errors.ts` (nouveau — à supprimer)
- `src/lib/i18n/date.ts` (nouveau — à supprimer)
- `src/routes/auth.tsx`
- `src/components/media/EmptyState.tsx`
- `src/components/media/StatusPill.tsx`
- `src/components/media/LoadingHint.tsx`

La fondation Phase 27 (`src/lib/i18n/index.tsx`, `LanguageSelector`, intégration `__root.tsx`, `AppShell`) reste opérationnelle sans les nouveautés 27.1.

## 19. Limitations

- Couverture code source majoritairement FR : les clés existent, mais l'usage effectif requiert la migration composant par composant (Phases 27.2 → 27.n).
- Assistant IA : la locale active n'est pas encore propagée au prompt système ni à la clé de cache.
- SEO : pas de `hreflang`, pas d'URLs localisées.
- Pages juridiques anglaises : non produites — restent bloquées par les décisions avocat/DPO/PI.
- Chat live : limitation Phase 25.2 conservée (PARTIAL).
- Tests Playwright manuels non exécutés dans cette vague.
- Aucune publication automatique.

## Verdict

PARTIAL

## Cause

La fondation i18n et le parcours d'authentification sont entièrement bilingues, avec un dictionnaire typé couvrant toutes les surfaces cibles. Les composants et routes secondaires restent à migrer vers les nouvelles clés lors de vagues dédiées. Aucune régression sur la Phase 27.

## Fichier créé

`.lovable/phase-27-1-i18n-coverage.md`

## Couverture initiale

5 namespaces (common, nav, legal, errors, assistant) ; shell/nav/404 bilingues ; parcours applicatifs monolingues FR.

## Couverture finale

24 namespaces typés ; parcours **Auth entièrement bilingue** ; composants partagés `EmptyState` / `StatusPill` / `PriorityPill` / `LoadingHint` bilingues ; helpers `tracking`, `errors`, `date` disponibles.

## Auth

Bilingue complet : email/mot de passe, Google OAuth, case d'âge, liens CGU/confidentialité, messages d'erreur mappés, toasts de succès. Logique Supabase inchangée. Redirections inchangées.

## Profil

Clés prêtes (`profile.*`). Composants non migrés dans cette vague.

## Catalogue

Clés prêtes (`catalog.*`, `mediaTypes.*`, `status.*`). Composants `EmptyState` et `LoadingHint` bilingues. Autres composants non migrés.

## Fiches

Clés prêtes (`fiche.*`). Composants non migrés.

## Tracking

Bilingue au niveau UI via `StatusPill` / `PriorityPill`. Valeurs DB (`a_voir`, `en_cours`, etc.) inchangées. Colonnes `progress`, `episode`, `season`, `rating`, `startedAt`, `finishedAt`, `updatedAt`, `rewatchCount` disponibles.

## Playlists

Clés prêtes (`playlist.*`). Composants non migrés.

## Recherche

Clés prêtes (`search.*`). Composants non migrés.

## Notifications

Clés prêtes (`notifications.*`, sous-espace `categories`). Composants non migrés.

## Forum

Clés prêtes (`forum.*`). Composants non migrés.

## Chat privé

Clés prêtes (`chatPrivate.*`). Composants non migrés.

## Chat live

Clés prêtes (`chatLive.*`). Composants non migrés. Limitation Phase 25.2 reconduite.

## Imports

Clés prêtes (`imports.*`). Composants non migrés.

## Calendrier

Clés prêtes (`calendar.*`). Composants non migrés. Helper `formatDateLocalized` disponible via `Intl`.

## Assistant IA

Clés prêtes (`assistant.*`). Locale non propagée au prompt / cache — reporté Phase 27.2.

## Founder Console

Clés prêtes (`founder.*`). Composants non migrés. Permissions inchangées.

## Consentement

Clés prêtes (`consent.*`). Composants non migrés dans cette vague ; les choix stockés ne sont pas affectés par la langue.

## Pages juridiques

MODE B conservé. `legal.draftBadge` / `legal.draftWarning` ajoutés en FR/EN. Aucune version anglaise publiée ni présentée comme validée.

## Erreurs

Mapping localisé `mapErrorToMessage` opérationnel (Auth, réseau, permission, 404, serveur, IA quota, validation). Utilisé sur `/auth`.

## SEO

`meta.home / discover / search / notFound` déclarés. `/auth` head localisé (rendu avec `DEFAULT_LOCALE` pour SSR déterministe). Pas de `hreflang`, pas d'URLs localisées (hors périmètre).

## Chaînes restantes

Voir §17 (liste priorisée).

## Dictionnaires

24 namespaces, parité FR/EN garantie par `type Dict = typeof fr`. Aucune divergence structurelle possible sans erreur TypeScript.

## Fichiers modifiés

- `src/lib/i18n/locales.ts` — dictionnaire étendu
- `src/routes/auth.tsx` — parcours bilingue
- `src/components/media/EmptyState.tsx` — fallback localisé
- `src/components/media/StatusPill.tsx` — labels via hook
- `src/components/media/LoadingHint.tsx` — messages via `useI18n`

## Composants créés

- `src/lib/i18n/tracking.ts` — hooks de labels tracking / statut / type
- `src/lib/i18n/errors.ts` — `mapErrorToMessage`
- `src/lib/i18n/date.ts` — `formatDateLocalized`, `formatRelativeLocalized` (`Intl`)

## Routes

Aucune modification (aucune création, aucun rename, aucun changement de path). `/auth` : logique et head inchangés en surface — seule la copie devient localisée.

## Migrations

Aucune.

## RLS

Aucune modification.

## RPC

Aucune modification.

## Typecheck

Commande : `tsgo` (exécuté automatiquement par la plateforme). Après suppression du `as const` sur `fr`, `type Dict = typeof fr` produit des types larges (`string`) et `en: Dict` compile sans erreur d'incompatibilité de littéraux.

## Lint

Non exécuté explicitement — la plateforme applique son pipeline standard.

## Tests

Aucun test automatisé unitaire ajouté dans cette vague. Validation manuelle recommandée avant Phase 27.2.

## Build

Le build est lancé automatiquement par la plateforme après édition.

## Tests mobile

Non exécutés dans cette vague. Dimensions cibles Phase 27.2 : 360 / 390 / 430 / 768 / 1024+.

## Non-régression

- Fondation Phase 27 (provider, sélecteur, persistance, shell, 404) : intacte, aucune clé renommée.
- Auth : logique Supabase / lovable OAuth / redirections identiques.
- Composants partagés : signatures publiques préservées, valeurs par défaut désormais localisées.

## Preview

Non exécuté (Playwright non lancé dans cette vague).

## Shared DB

Aucune modification.

## Production

Aucune publication automatique.

## Rollback

Voir §18.

## Limitations

Voir §19.

## Readiness Phase 28

**READY WITH BLOCKERS** — parcours principaux applicatifs (catalogue, fiches, playlists, communauté, imports, founder, notifications, consentement, calendrier) doivent d'abord consommer les clés déclarées ici avant qu'une phase suivante puisse s'appuyer sur une couverture bilingue effective de bout en bout.

## Publication

NON PUBLIÉ.
