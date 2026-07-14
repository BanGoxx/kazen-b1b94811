
# Phase 27.1 — Extension contrôlée de la couverture i18n

Objectif : transformer la fondation i18n de la Phase 27 en couverture bilingue réellement exploitable sur les parcours principaux, sans toucher à la DA, aux routes, aux RLS/RPC, aux données, ni aux blocages juridiques.

## Cadre

- Réutiliser strictement `src/lib/i18n/*` et `LanguageSelector`. Aucune 2ᵉ librairie, aucune duplication de composants par langue.
- Aucune modification : routes, callbacks OAuth, migrations, RLS, RPC, enums techniques, valeurs stockées.
- Pages juridiques : traductions traitées en brouillons MODE B (`noindex`, avertissement de non-validation conservés). Aucune version anglaise présentée comme validée.
- Contenus utilisateurs, titres officiels, synopsis fournisseurs, pseudos, noms propres : jamais traduits.
- Pas de préfixes `/fr` / `/en`, pas de `hreflang` complet — documenté comme limite SEO.

## Approche

Vu la taille réelle du code (14k+ lignes de routes, 136 composants), la phase sera livrée en vagues priorisées, avec verdict final **PARTIAL** assumé et documenté si toutes les surfaces ne sont pas couvertes en un passage. Chaque vague : audit → extraction de clés → ajout typé dans `locales.ts` (parité FR/EN stricte) → remplacement dans les composants → vérif typecheck.

### Vague 1 — Fondations transverses
- Étendre `Dict` avec namespaces : `auth`, `profile`, `catalog`, `fiche`, `tracking`, `playlist`, `search`, `notifications`, `forum`, `chatPrivate`, `chatLive`, `import`, `calendar`, `assistant`, `founder`, `consent`, `legal`, `errors`, `forms`, `empty`, `toasts`, `meta`.
- Helper `useLocalizedTrackingStatus()` (mapping enum DB → libellé) sans changer les valeurs stockées.
- Helper `formatDateLocalized` / mois-jours via `Intl` (remplace tableaux manuels côté calendrier).
- Mapping localisé des erreurs Auth/Supabase/réseau/validation/IA (fonction `mapErrorToMessage(err, t)`), messages techniques restent dans les logs.

### Vague 2 — Auth & Profil
- `src/routes/auth.tsx` : tous labels, placeholders, boutons, toasts, disclaimer d'âge, liens CGU/confidentialité. Logique Auth inchangée.
- `_authenticated/profil.tsx` + `AccountDeletion`, `ProfilePrivacy`, `EmailPreferences`, `NotificationPreferences`, `ChatPreference` : libellés système. Pseudos/bio/listes non traduits.

### Vague 3 — Catalogue, Fiches, Tracking, Playlists
- `MediaCard`, `CatalogGrid`, `PaginatedCatalog`, `FilterBar`, `ListControls`, `SectionHeader`, `EmptyState`, `LoadingHint`, `StatusPill`, `RatingBadge`, `PlatformBadge`, `WhereToWatch`, `NextEpisodeCard`, `EpisodeList`, `SeasonNavigator`, `FicheSection`, `FicheTrackingBadge`, `FicheReviews`, `FicheCorrectionRequest`, `RelatedContent`, `RecommendationAssistant`, `AddToPlaylist`, `UserListPanel`, `MemberCTA`, `TrailerDialog`, `MediaCarousel`, `CategoryBand`, `CommunityListsBand`.
- Routes catalogue : `anime.*`, `series`, `films`, `a-venir`, `entite.*`, `franchise.*`, `univers.*`, `media.$source.$id`, `pour-vous`, `index`.
- Tracking : libellés d'états, colonnes, dates, notes ; valeurs DB conservées.
- Playlists : `mes-playlists`, `playlist.$id`, `PlaylistReviews`, `CollabPanel`.

### Vague 4 — Recherche, Notifications, Calendrier
- `recherche.tsx`, `QuickSearch`, `SearchAutocomplete`, `SearchResultCard` : placeholders, catégories, résultats, aucun résultat.
- `notifications.tsx`, `NotificationBell` : catégories, verbes, boutons de préférence. Templates avec interpolation typée (pas de concaténation).
- `calendrier.tsx` : jours/mois via `Intl`, filtres, états vides.

### Vague 5 — Communauté (forum, chat privé, chat live)
- Forum : `communaute.*`, `forum-ui`, `CoverField`, `ForumModerationSection`, `CommunityDiscovery`, `ReportDialog`. Titres/messages utilisateurs conservés.
- Chat privé : `messages.tsx` (UI système uniquement).
- Chat live : `communaute.direct.tsx` UI ; limitation Phase 25.2 PARTIAL reconduite.

### Vague 6 — Imports, Assistant IA, Founder, Consentement, Légal
- Imports : `import.tsx`, providers, previews, erreurs, statuts.
- Assistant : `AssistantChat`, `assistant-chat.functions.ts` — la locale active est passée au prompt système ; clé de cache inclut la locale pour éviter les collisions FR/EN. Quotas et logique inchangés.
- Founder : `fondateur.tsx`, `FounderBadge`, `FounderBetaSection`, `FounderSystemNotice`, `FounderTestSender`, `MediaRequestsPanel`, `CorrectionRequestsPanel`.
- Consentement : `CookieBanner`, `PreferencesDialog` (déjà partiel) — parité complète, aucun rechargement de service au changement de langue.
- Légal MODE B : `cgu`, `confidentialite`, `mentions-legales`, `regles-communautaires` — versions EN ajoutées comme brouillons non validés, bannière d'avertissement traduite, `noindex` conservé.

### Vague 7 — Métadonnées & finitions
- `head()` localisé pour accueil, découverte, catalogue, recherche, auth, profil public, 404, erreur. Titres officiels des fiches non traduits ; descriptions système localisées.
- Limitation SEO documentée : pas d'URLs localisées ni `hreflang` complet dans cette phase.

## Vérifications

- `tsgo` (typecheck strict, garantit la parité via `Dict`).
- Build automatique.
- Sondages Playwright : bascule FR↔EN sur Auth, Accueil, Catalogue, Fiche, Recherche, Notifications, Forum, Assistant. Screenshots avant/après en dark et light.
- Contrôles console (hydratation, clés manquantes, warnings React).
- Responsive : 360 / 390 / 768 / 1024 sur écrans clés.

## Livrables

- `.lovable/phase-27-1-i18n-coverage.md` (structure imposée par le brief : 19 sections + rapport final).
- Mises à jour typées dans `src/lib/i18n/locales.ts`.
- Helpers : `src/lib/i18n/tracking.ts`, `src/lib/i18n/errors.ts`, `src/lib/i18n/date.ts`.
- Composants existants mis à jour pour consommer `useI18n()`.
- Aucune migration, aucune modification de RLS/RPC, aucune publication.

## Verdict attendu

Réaliste : **PARTIAL** — parcours principaux (Auth, catalogue, fiche, tracking, recherche, notifications, playlists, forum UI, imports, assistant, consentement, calendrier, founder core) bilingues ; pages juridiques en brouillon EN ; chat live et certains écrans secondaires documentés comme non couverts. Publication : NON PUBLIÉ.

## Rollback

- Revert des commits de la phase ; la fondation i18n Phase 27 reste intacte.
- Aucune donnée modifiée, aucun schéma altéré.

## Confirmation demandée

Cette phase est très large (potentiellement 60–100 fichiers modifiés). Confirme-moi :
1. Je procède en une seule passe avec verdict PARTIAL documenté si nécessaire ?
2. Ou tu préfères que je livre uniquement les vagues 1–3 d'abord (fondations + Auth + Profil + Catalogue/Fiches/Tracking/Playlists), puis les suivantes dans des tours dédiés — meilleure qualité, moins de risque de régression ?
