# Phase 27.3B — Finalisation i18n fiches / tracking / saisons / épisodes / recommandations

**Statut :** PASS (surfaces ciblées migrées)
**Date :** 2026-07-15
**Portée :** finalisation i18n Phase 27.3 sur les composants transverses de fiche encore FR-only. Aucune modification DA, routes, migrations, RLS, RPC, enums techniques.

## Audit préalable

| Fichier | Avant | Après |
| --- | --- | --- |
| `ExpandableText.tsx` | « Lire plus / Lire moins » en dur | migré `t.fiche.readMore/readLess` |
| `EpisodeList.tsx` | libellés épisodes / « à venir » / toggle en dur | migré `t.fiche.episode*` + `formatDateLocalized` |
| `TrailerDialog.tsx` | disclaimer YouTube + boutons FR en dur | migré `t.fiche.trailer*` / `t.consent.*` |
| `FicheTrackingBadge.tsx` | « Dans ma liste / Favori » en dur | migré via `useWatchStatusLabels` + `t.fiche.*` |
| `CreditScroller.tsx` | `aria-label` FR en dur | migré `t.fiche.viewProfile` |
| `SeasonNavigator.tsx` | « Saisons / Actuelle / précédente / suivante » | migré `t.fiche.season*` |
| `NextEpisodeCard.tsx` | compte à rebours et libellés dates FR | migré `t.fiche.next*` + `formatDateLocalized` |
| `RelatedContent.tsx` | filtres/aria/labels FR en dur | migré `t.fiche.filter*` / `t.catalog.all` / `useMediaTypeLabels` |
| `RecommendationAssistant.tsx` | dialog complet en FR | migré namespace `reco` |
| `FicheCorrectionRequest.tsx` | dialog signalement en FR | migré namespace `correction` |
| `MissingTitleRequest.tsx` | dialog proposition en FR | migré namespace `mediaRequest` |
| `FicheArticles.tsx` | titres/tags/CTA FR en dur | migré `t.fiche.article*` |

## Modifications dictionnaire

Ajouts non destructifs à `src/lib/i18n/locales.ts` (parité FR/EN stricte via type `Dict`) :

- Extensions `fiche` : `readMore`, `readLess`, `episodeAiredOne/Other`, `episodesUpcoming`, `showAllEpisodes`, `reduce`, `trailer*`, `viewProfile`, `season*`, `next*`, `filterByType`, `filterRelated`, `noRelatedForFilter`, `partOfSagaPrefix`, `articlesRelated`, `articlesRelatedTo`, `articleSameUniverse`, `articleRelatedWork`, `articlesViewAll`, `whereToWatch`.
- Nouveau namespace `correction` (12 clés) — signalement d'erreurs de fiche.
- Nouveau namespace `mediaRequest` (9 clés) — proposition de titre manquant.
- Nouveau namespace `reco` (11 clés) — assistant de recommandations.

Aucune clé existante retirée ou renommée. Enum labels DB (`STATUS_LABELS`, `MEDIA_TYPE_LABELS`) conservés inchangés.

## Contrôles

- `bunx tsgo --noEmit` → exit 0 (parité FR/EN vérifiée par le type `Dict`).
- Aucune modification `src/integrations/supabase/*`, migrations, `.env`, RLS, RPC.
- Aucun changement UI/DA : uniquement substitution de chaînes → clés i18n.

## Non modifié

- `FilterBar.tsx`, `MediaBadges.tsx`, `WhereToWatch.tsx`, `MediaCard.tsx` : intacts (Phase 27.3).
- `FicheReviews.tsx`, `AddToPlaylist.tsx`, `UserListPanel.tsx`, `CommunityListsBand.tsx`, `CategoryBand.tsx`, `RotatingHero.tsx`, `DiscoverHero.tsx`, `SectionHeader.tsx`, `FicheSection.tsx` : hors périmètre 27.3B — reportés Phase 27.4.
- `head()` SEO des routes catalogue/fiche : limitation `head()` statique — Phase 27.5.
- Mapping genres AniList/TMDB (`ANILIST_GENRES`, `TMDB_GENRES`) : FR-only — Phase 27.5.

## Verdict

**PASS** — surfaces fiches / tracking / saisons / épisodes / recommandations / signalements / propositions entièrement bilingues FR/EN. Aucune régression DA/route/backend.

## Publication

NON PUBLIÉ.
