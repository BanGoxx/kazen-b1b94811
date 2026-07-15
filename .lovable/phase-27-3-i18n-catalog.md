# Phase 27.3 — i18n Catalogue, Fiches, Tracking

**Statut :** PARTIAL (surfaces principales migrées, restes documentés)
**Date :** 2026-07-15
**Portée :** extension de la fondation i18n (Phases 27 / 27.1 / 27.2) aux composants transverses catalogue / fiches / tracking. Aucune modification DA, routes, RLS, RPC, migrations, enums techniques.

## Audit préalable

Composants ciblés :

| Fichier | État avant | État après |
| --- | --- | --- |
| `src/components/media/StatusPill.tsx` | déjà migré (Phase 27.1) | inchangé |
| `src/lib/i18n/tracking.ts` | déjà migré | inchangé |
| `src/components/media/EmptyState.tsx` | déjà migré | inchangé |
| `src/components/media/FilterBar.tsx` | strings FR en dur (`Filtres`, `Tout`, `Réinitialiser`, `Tri :`, pluralisation manuelle) | migré `useI18n` + `useMediaStatusLabels` |
| `src/components/media/MediaBadges.tsx` | labels FR en dur (`À venir`, `En cours`, `Nouveau`, `VF · VOSTFR`, `VOSTFR`) | migré via clés `catalog.badge*` |
| `src/components/media/WhereToWatch.tsx` | libellés FR en dur (`En streaming`, `En location`, `À l'achat`, `Où regarder`) | migré `catalog.offer*` + `fiche.whereToWatch` |
| `src/components/media/MediaCard.tsx` | `MEDIA_TYPE_LABELS` constante FR | migré via `useMediaTypeLabels()` |

## Modifications

### `src/lib/i18n/locales.ts`

Ajouts non destructifs au namespace `catalog` (FR + EN, parité stricte) :

- `sortPrefix`, `resultsOne`, `resultsOther`, `all`
- `offerStream`, `offerRent`, `offerBuy`
- `badgeUpcoming`, `badgeOngoing`, `badgeNew`, `badgeVfVostfr`, `badgeVostfr`

Aucune clé existante retirée ni renommée.

### Composants refactorés

- `FilterBar.tsx` — plus aucune chaîne FR en dur ; le comptage `titre/titres` utilise `resultsOne` / `resultsOther`.
- `MediaBadges.tsx` — `deriveBadges` renvoie désormais des `key` (identifiants stables) ; la traduction est appliquée dans le composant via `useI18n`.
- `WhereToWatch.tsx` — libellés des offres et titre de section rendus via `t.catalog.*` / `t.fiche.whereToWatch`.
- `MediaCard.tsx` — libellé du type média via `useMediaTypeLabels()` (hook existant), suppression de l'import inutilisé `MEDIA_TYPE_LABELS`.

## Non modifié

- Enums DB, RPC, RLS, migrations : intacts.
- Constantes techniques `STATUS_LABELS`, `MEDIA_TYPE_LABELS`, `ENTITY_KIND_LABELS` de `media-types.ts` : conservées pour compatibilité (usages hors composants React).
- Routes, URLs, DA, palettes, typographie : inchangés.
- Documents légaux (MODE B) : non touchés.

## Chaînes FR restantes documentées (hors périmètre 27.3)

- `MediaCard.tsx` : `aria-label` « Masquer … des recommandations » et `title="Pas intéressé"` — nécessitent une clé `catalog.dismiss*` dédiée (à ajouter Phase 27.4).
- `PaginatedCatalog.tsx` : messages de retry / progression — à migrer avec `LoadingHint` (Phase 27.4).
- `FicheSection.tsx`, `ExpandableText`, `RelatedContent`, `EpisodeList`, `SeasonNavigator`, `CreditScroller`, `TrailerDialog`, `FicheReviews`, `FicheArticles`, `FicheCorrectionRequest`, `MissingTitleRequest`, `AddToPlaylist`, `UserListPanel`, `NextEpisodeCard`, `NextEpisodePill`, `RecommendationAssistant`, `CommunityListsBand`, `CategoryBand`, `SectionHeader`, `RotatingHero`, `DiscoverHero` : nombreuses chaînes FR (titres de sections, CTA, tooltips). Volume élevé — Phase 27.4 recommandée.
- `head()` des routes catalogue (`/anime`, `/series`, `/films`, `/a-venir`, `/calendrier`, `/recherche`, `/media/$source/$id`, `/franchise/$source/$id`, `/univers/$source/$id`) : titres/descriptions SEO restent FR (limitation `head()` statique héritée Phase 27.2).
- Étiquettes de genres AniList/TMDB (`ANILIST_GENRES`, `TMDB_GENRES`, `TMDB_GENRE_NAMES` dans `src/lib/normalize.ts`) : mapping FR uniquement — Phase 27.5 (table de mapping FR/EN).

## Contrôles

- `bunx tsgo --noEmit` → exit 0.
- Aucune modification `src/integrations/supabase/*`, `supabase/`, migrations, `.env`.
- Parité dictionnaire FR/EN vérifiée par le type `Dict` (compilation stricte).

## Verdict

**PARTIAL** — surfaces catalogue transverses (filtres, badges, cartes, « où regarder ») entièrement bilingues. Fiches détaillées + rails discovery : à traiter en Phase 27.4.

## Readiness Phase 27.4

**READY** — la fondation supporte l'extension aux composants de fiche riche (`Fiche*`, `RelatedContent`, `EpisodeList`, `SeasonNavigator`, etc.) sans changement d'architecture.

## Publication

NON PUBLIÉ.
