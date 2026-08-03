# KAZEN — Catalogue fonctionnel

Inventaire exhaustif des fonctionnalités, domaine par domaine, avec les fichiers concernés.

---

## 1. Découverte

| Fonction | Où |
| --- | --- |
| Accueil éditorial : héros rotatif, bandes par catégorie, bloc « Pour vous », articles récents | `src/routes/index.tsx`, `components/media/RotatingHero.tsx`, `CategoryBand.tsx`, `ForYouHomeBlock.tsx`, `RecentArticles.tsx` |
| Catalogues anime / séries / films, pagination et scroll infini persistant | `routes/anime.*`, `series.tsx`, `films.tsx`, `components/media/PaginatedCatalog.tsx`, `CatalogGrid.tsx` |
| Filtres (genre, année, statut, format, plateforme) et tri, mémorisés par session | `components/media/FilterBar.tsx`, `ListControls.tsx`, `lib/media-filters.ts`, `lib/catalog-state.ts` |
| Navigation par saison | `routes/anime.saison.tsx`, `lib/seasons.ts`, `components/media/SeasonNavigator.tsx` |
| Calendrier des diffusions et sorties à venir | `routes/calendrier.tsx`, `a-venir.tsx`, `lib/next-episode.ts`, `components/media/NextEpisodeCard.tsx` |
| Recherche : autocomplétion, recherche rapide, classement de pertinence | `routes/recherche.tsx`, `components/media/SearchAutocomplete.tsx`, `QuickSearch.tsx`, `lib/search-rank.ts`, `search-filters.ts` |
| Recommandations « Pour vous » + retour de pertinence | `routes/pour-vous.tsx`, `lib/recommend.ts`, `recommend.functions.ts`, `use-recommendations.tsx`, `components/media/ForYouRails.tsx` |
| Actualités éditoriales | `routes/actualites.*`, `lib/news.ts` |

## 2. Fiche détail (`/media/:source/:id`)

Règle permanente du projet : **richesse type Nautiljon, UX plus propre et premium**,
jamais au prix de la lisibilité ni de la performance.

Sections disponibles : synopsis extensible, badges (format, statut, score, plateformes),
crédits défilants (staff, personnages), liste d'épisodes, navigateur de saison,
galerie vidéo et bande-annonce, où regarder, contenus liés et franchise/univers,
articles associés, critiques membres, badge de suivi, ajout à une playlist,
demande de correction, signalement.

Fichiers : `routes/media.$source.$id.tsx`, `franchise.$source.$id.tsx`,
`univers.$source.$id.tsx`, `entite.$kind.$id.tsx`, et
`components/media/{ExpandableText, MediaBadges, CreditScroller, EpisodeList,
SeasonNavigator, VideoGallery, TrailerDialog, WhereToWatch, RelatedContent,
RelatedScroller, FicheArticles, FicheReviews, FicheSection, FicheTrackingBadge,
FicheCorrectionRequest, AddToPlaylist, EntityProfileDialog, SafeImage, SafeSection}.tsx`.

## 3. Suivi personnel

- Statuts : en cours, terminé, prévu, en pause, abandonné ; progression par épisode,
  note personnelle, compteur de rewatch, dates de début/fin.
- Écran `/mes-listes` avec filtres, tri et actions groupées.
- Statistiques (`/statistiques`) : volumes, genres, plateformes, historique.
- Récap hebdomadaire (`/recap`) avec accusé de lecture.

Fichiers : `lib/use-list.tsx`, `list.functions.ts`, `user-list.ts`, `tracking.ts`,
`stats.ts`, `stats.functions.ts`, `recap.ts`, `recap.functions.ts`, `use-recap.tsx`,
`components/media/UserListPanel.tsx`.

## 4. Playlists et critiques

- Playlists publiques/privées, éléments ordonnés, likes.
- Collaboration : collaborateurs, demandes d'accès, décision d'acceptation, éditeurs.
- Avis sur playlists partagées ; critiques de fiches avec réponses et likes.

Fichiers : `lib/playlists.ts`, `playlist-collab.ts`, `playlist-reviews.ts`,
`playlist-reviews.functions.ts`, `reviews.ts`, `routes/playlist.$id.tsx`,
`_authenticated/mes-playlists.tsx`, `components/playlist/*`.

## 5. Communauté

| Fonction | Où |
| --- | --- |
| Forum : catégories, sujets, réponses, couverture de sujet | `routes/communaute.*`, `lib/forum.ts`, `forum-cover.ts`, `components/community/*` |
| Messagerie privée 1-à-1 : invitation, acceptation, refus, archivage, blocage, édition/suppression | `routes/_authenticated/messages.tsx`, `lib/chat.ts`, `chat.functions.ts`, `components/chat/*` |
| Salons de chat en direct | `routes/_authenticated/communaute.direct.tsx`, `lib/live-chat.ts`, `live-chat.functions.ts` |
| Profils publics, badges, découverte de membres | `routes/membre.$id.tsx`, `lib/public-profile.ts`, `components/community/CommunityDiscovery.tsx`, `components/founder/PublicBadge.tsx` |
| Signalements de contenu et de messages forum | `components/moderation/ReportDialog.tsx` |

## 6. Modération

- File unifiée : signalements, demandes de correction, demandes de médias.
- Actions tracées dans `moderation_actions` via la RPC `moderate_content`.
- Sanctions : masquage de message, suppression, avis système.

Fichiers : `routes/_authenticated/moderation.tsx`, `lib/moderation.functions.ts`,
`use-moderator.ts`, `components/moderation/*`, `components/community/ForumModerationSection.tsx`.

## 7. Notifications et e-mails

- Notifications in-app typées (réponse forum, message, mention, avis système…),
  cloche dans l'en-tête, page dédiée, préférences par type.
- Digest e-mail (Resend) avec éligibilité, rendu HTML, journalisation et
  désinscription par jeton signé (`/desabonnement`).

Fichiers : `lib/notifications.ts`, `notifications.functions.ts`, `use-notifications.tsx`,
`digest.ts`, `use-digest.tsx`, `email/*`, `email-prefs.functions.ts`,
`email-delivery.functions.ts`, `unsubscribe.functions.ts`,
`components/notifications/NotificationBell.tsx`, `components/settings/*`.

## 8. Import / export

**Import V1 (actif)** — MyAnimeList (XML), AniList (liste utilisateur), Nautiljon.
Flux : dépôt du fichier / identifiant → analyse → correspondance de titres →
prévisualisation cochable → confirmation → lot enregistré (`import_batches` / `import_items`).
Fichiers : `routes/_authenticated/import.tsx`, `lib/import.functions.ts`,
`lib/import/{mal-parser, anilist-list, nautiljon-parser, match, providers, import-schema}.ts`.

**Import V2 canonique (intégré, désactivé)** — récupération serveur des métadonnées
canoniques par tronçons avec verrous, drapeau serveur *fail-closed*.
Fichiers : `lib/import-canonical-v2.{server,functions}.ts`,
`components/import/CanonicalV2Import.tsx`, 5 fichiers de tests.

**Export** — JSON et CSV de toutes les données personnelles (portabilité RGPD).
Fichiers : `lib/export.ts`, `export.functions.ts`.

## 9. Assistant IA

Mascotte flottante, chat en streaming, recommandations contextuelles, quotas visibles,
réglages d'activation par utilisateur, cache de réponses versionné, avertissement
« contenu généré par IA ».

Fichiers : `components/assistant/{AssistantChat, KazenAssistantMascot}.tsx`,
`lib/assistant.ts`, `assistant-chat.functions.ts`, `assistant-cache.ts`,
`ai-gateway.server.ts`, `ai-usage.functions.ts`, `routes/api/chat.ts`,
`components/settings/ChatPreference.tsx`.

## 10. Premium, bêta et fondateur

Badges supporter / bêta premium, boîte de dialogue de mise à niveau, indices premium,
page `/soutien`, retours bêta avec limitation de débit, espace fondateur
(`/fondateur` : avis système, envoi de test, section bêta).

Fichiers : `lib/premium.tsx`, `founder.ts`, `founder.functions.ts`,
`beta-feedback.functions.ts`, `components/premium/*`, `components/founder/*`,
`components/beta/BetaFeedbackDialog.tsx`.

## 11. Conformité et vie privée

Vérification d'âge, CGU, politique de confidentialité, mentions légales, règles
communautaires, bannière et préférences de cookies, avertissement IA, suppression de
compte, attributions de sources (AniList/TMDB).

Fichiers : `routes/{cgu, confidentialite, mentions-legales, regles-communautaires}.tsx`,
`lib/consent.tsx`, `legal-config.ts`, `components/consent/*`,
`components/settings/{AccountDeletion, ProfilePrivacy}.tsx`,
`components/legal/LegalPageLayout.tsx`.

## 12. Transverse

- **i18n FR/EN** — `lib/i18n/*`, sélecteur dans l'en-tête.
- **Thème** — dark-mode d'abord, bascule `components/layout/ThemeToggle.tsx`.
- **Shell** — `components/RootShell.tsx`, `components/layout/AppShell.tsx`, `BackToTop.tsx`.
- **SEO** — `head()` par route, `sitemap.xml`, `robots.txt`, JSON-LD sur les fiches.
- **Robustesse** — `SafeImage`, `SafeSection`, `EmptyState`, `LoadingHint`,
  `lib/error-capture.ts`, `error-page.ts`, `lovable-error-reporting.ts`.
