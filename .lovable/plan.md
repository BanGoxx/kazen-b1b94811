# NEXUS MEDIA — Plan d'architecture produit

Application de découverte et de suivi média (anime, séries, films) en français, premium et élégante. Ce document est un **plan uniquement** — aucun code n'est écrit à ce stade.

---

## 1. Architecture produit

**Principe fondateur : séparation stricte entre métadonnées externes et données utilisateur.**

```text
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (React / TanStack Start)       │
│  UI FR · dark-first · design system · TanStack Query cache│
└───────────────┬───────────────────────┬─────────────────┘
                │                        │
     Server Functions            Server Functions
     (métadonnées)               (données perso, auth)
                │                        │
   ┌────────────┴─────────┐    ┌─────────┴──────────┐
   │  Couche METADATA      │    │  Couche USER DATA   │
   │  - AniList (anime)    │    │  - Supabase Auth    │
   │  - TMDB (séries/films)│    │  - Tables user (RLS)│
   │  → normalisée en      │    │  → référencent les  │
   │    MediaItem unifié   │    │    médias par clé   │
   └───────────────────────┘    └─────────────────────┘
```

- **Métadonnées externes** (titres, synopsis, images, plateformes, dates) : jamais stockées comme source de vérité. Récupérées via server functions, mises en cache (TanStack Query + cache court côté serveur). Optionnellement snapshot léger en base pour les listes.
- **Données utilisateur** (listes, statut, notes, tags, priorité, favoris) : Supabase, protégées par RLS, ne référencent un média que par une **clé composite stable** (`source` + `external_id`).
- **Couche de normalisation** : convertit AniList et TMDB en un type `MediaItem` unifié consommé par toute l'UI.

**Stack** : TanStack Start (SSR), React 19, Tailwind v4, shadcn/ui, TanStack Query, Supabase (Lovable Cloud).

---

## 2. Cartographie des pages

| Page | Rôle | Auth |
|------|------|------|
| Découverte (`/`) | Hub éditorial : tendances, à venir, sélections croisées anime/séries/films | Public |
| Anime (`/anime`) | Catalogue anime (tendances, populaires, filtres) | Public |
| Séries (`/series`) | Catalogue séries TV | Public |
| Films (`/films`) | Catalogue films | Public |
| Anime saisonnier (`/anime/saison`) | Grille par saison/année (hiver, printemps, été, automne) | Public |
| Sorties à venir (`/a-venir`) | Prochaines sorties, tous types, triées par date | Public |
| Calendrier (`/calendrier`) | Vue calendrier des sorties (semaine/mois) | Public |
| Recherche (`/recherche`) | Recherche multi-sources unifiée + filtres | Public |
| Détail média (`/media/$source/$id`) | Fiche complète : synopsis, casting, plateformes, épisodes/saisons, actions de suivi | Public (actions = auth) |
| Mes listes (`/mes-listes`) | Listes perso par statut, filtres, tags, priorité | Auth |
| Favoris (`/favoris`) | Sous-vue rapide des favoris | Auth |
| Connexion (`/auth`) | Email/mot de passe + Google | Public |
| Profil / réglages (`/profil`) | Préférences, langue d'affichage des titres, thème | Auth |

---

## 3. Structure des routes (TanStack Start, file-based)

```text
src/routes/
  __root.tsx                      → shell, thème, métadonnées
  index.tsx                       → Découverte
  anime.tsx                       → layout catalogue anime (<Outlet/>)
  anime.index.tsx                 → /anime
  anime.saison.tsx                → /anime/saison
  series.tsx                      → /series
  films.tsx                       → /films
  a-venir.tsx                     → /a-venir
  calendrier.tsx                  → /calendrier
  recherche.tsx                   → /recherche
  media.$source.$id.tsx           → /media/:source/:id (source = anilist|tmdb-tv|tmdb-movie)
  auth.tsx                        → /auth
  _authenticated/
    route.tsx                     → gate géré par l'intégration (ssr:false)
    mes-listes.tsx                → /mes-listes
    favoris.tsx                   → /favoris
    profil.tsx                    → /profil
```

Server functions (jamais dans `src/server/`) :
```text
src/lib/
  anilist.functions.ts   · anilist.server.ts   (fetch + GraphQL)
  tmdb.functions.ts      · tmdb.server.ts      (fetch REST, clé serveur)
  discover.functions.ts                        (agrégation multi-sources)
  user-lists.functions.ts (requireSupabaseAuth) (CRUD listes perso)
  normalize.ts                                 (mappers → MediaItem)
```

Routes publiques → server functions publiques (clé publishable / anon). Routes `_authenticated` → `requireSupabaseAuth`.

---

## 4. Carte des composants réutilisables

**Primitives (shadcn)** : Button, Card, Badge, Dialog, Sheet, Tabs, Select, Input, Tooltip, Skeleton, Avatar, DropdownMenu.

**Design system (métier)** :
- `MediaCard` — poster, titre FR, type, note, badges plateformes ; variantes `poster` / `landscape` / `compact`.
- `MediaGrid` — grille responsive + états de chargement (skeletons).
- `MediaCarousel` — rangée horizontale scrollable (sections Découverte).
- `PlatformBadge` / `PlatformRow` — logo + nom plateforme, data-driven.
- `MediaHero` — bannière fiche détail (backdrop, titre, actions).
- `StatusSelector` — menu statut (À voir, En cours, Terminé, En pause, Abandonné).
- `FavoriteToggle`, `PriorityStars`, `TagEditor`, `NoteEditor` — actions perso.
- `AddToListButton` — orchestre statut/favori/priorité.
- `SeasonPicker`, `CalendarGrid`, `DateBadge`, `CountdownPill`.
- `FilterBar` (genre, année, format, plateforme, tri), `SearchBar` (debounce + résultats groupés).
- `RatingBadge`, `GenreChips`, `EmptyState`, `SectionHeader`.
- **Layout** : `AppShell`, `SideNav` / `MobileNav`, `TopBar`, `ThemeToggle`, `LangToggle`, `Footer`.

---

## 5. Schéma Supabase

Toutes les tables `public`, RLS activée, GRANTs explicites. Aucune métadonnée externe comme source de vérité — uniquement une clé de référence + snapshot léger optionnel pour l'affichage des listes.

```text
enum media_source     : 'anilist' | 'tmdb_tv' | 'tmdb_movie'
enum watch_status     : 'a_voir' | 'en_cours' | 'termine' | 'en_pause' | 'abandonne'
enum priority_level   : 'basse' | 'normale' | 'haute'

profiles
  id (uuid, PK → auth.users, cascade)
  display_name, avatar_url
  preferred_title_lang ('fr'|'en'|'romaji'), theme
  created_at

user_media  (une ligne = un média suivi par un user)
  id uuid PK
  user_id uuid → auth.users (cascade)
  source media_source
  external_id text
  status watch_status
  is_favorite bool default false
  priority priority_level default 'normale'
  progress int default 0          (épisodes vus)
  rating int  (0-10, note perso, nullable)
  -- snapshot léger pour affichage listes sans refetch
  title_snapshot text, poster_snapshot text, media_type text
  created_at, updated_at
  UNIQUE (user_id, source, external_id)

user_notes
  id uuid PK, user_media_id → user_media (cascade), user_id, body text, updated_at

tags
  id uuid PK, user_id, name text, color text, UNIQUE(user_id, name)

user_media_tags  (M:N)
  user_media_id → user_media (cascade), tag_id → tags (cascade)
  PK (user_media_id, tag_id)
```

**RLS** : chaque table filtrée sur `auth.uid() = user_id`. Fonction `has_role` non nécessaire au MVP (pas de rôles admin).

**GRANTs** (modèle, par table utilisateur) :
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
GRANT ALL ON public.<table> TO service_role;
-- pas de GRANT anon : données strictement privées
```

Trigger : création auto de `profiles` à l'inscription.

---

## 6. Plan d'intégration des API externes

**AniList (anime)** — GraphQL public, sans clé, généreux en rate-limit.
- Requêtes : trending, popular, saison courante (`season`+`seasonYear`), à venir (`status: NOT_YET_RELEASED` + `airingSchedule`), détail par id, recherche.
- Calendrier de diffusion via `airingSchedule` (timestamps épisodes).

**TMDB (séries + films)** — REST, **clé API côté serveur uniquement** (secret Lovable Cloud), langue `fr-FR`, région `FR`.
- Endpoints : trending, discover (filtres), upcoming, on_the_air, détail (`append_to_response=credits,videos,watch/providers`), search.
- **Plateformes** : `watch/providers` région `FR` (Netflix, Prime, Disney+, Canal+, etc.). AniList n'expose pas les plateformes FR de façon fiable → mapping enrichi manuellement / via TMDB pour les anime disponibles, sinon table de correspondance interne (Crunchyroll, ADN).

**Accès** : toujours via server functions (jamais fetch direct client). Cache TanStack Query par clé de requête + `staleTime` adapté (long pour catalogue, court pour calendrier).

---

## 7. Stratégie de normalisation (anime / séries / films)

Type pivot unique consommé par toute l'UI :

```text
MediaItem {
  key: `${source}:${externalId}`
  source: 'anilist' | 'tmdb_tv' | 'tmdb_movie'
  mediaType: 'anime' | 'series' | 'movie'
  title: { fr, en, original }      // choix selon préférence user
  synopsis, posterUrl, backdropUrl
  genres: string[]
  score: number | null             // normalisé /100 → affiché /10
  status: 'à venir' | 'en cours' | 'terminé'
  releaseDate | startDate | endDate
  nextEpisode?: { number, airDate }
  seasonsCount?, episodesCount?, runtime?
  platforms: Platform[]            // via provider mapping FR
  raw: unknown                     // payload source pour la fiche détail
}

Platform { id, name, logoUrl, type: 'stream'|'buy'|'rent' }
```

**Mappers** : `fromAniList()`, `fromTmdbTv()`, `fromTmdbMovie()` → `MediaItem`. Champs manquants tolérés (nullables). Table interne `PLATFORMS` (constantes app) : id, nom FR, logo, couleur — pour un affichage cohérent quelle que soit la source. Scores harmonisés sur /100 en interne, affichés /10.

---

## 8. Parcours utilisateurs clés

1. **Découvrir sans compte** : arrivée `/` → carrousels tendances/à venir → clic `MediaCard` → fiche détail (public) → CTA « Ajouter à ma liste » invite à la connexion.
2. **Suivre un média** : fiche → `AddToListButton` → statut + priorité + favori → écrit dans `user_media` (upsert sur clé composite) → toast confirmation.
3. **Organiser ses listes** : `/mes-listes` → onglets par statut → filtrer par tag/priorité/plateforme → éditer note/tags/progression inline.
4. **Anticiper les sorties** : `/a-venir` ou `/calendrier` → repérer une sortie → ajouter en « À voir » avec priorité haute.
5. **Explorer une saison d'anime** : `/anime/saison` → choisir saison/année → grille → suivre.
6. **Rechercher** : `/recherche` → saisie debounce → résultats groupés (Anime / Séries / Films) → fiche.
7. **Auth** : `/auth` email+mot de passe ou Google → redirection vers destination initiale.

---

## 9. Périmètre MVP vs V2

**MVP**
- Découverte, Anime, Séries, Films, Recherche, fiche détail.
- Normalisation MediaItem (3 sources) + affichage plateformes FR.
- Auth (email + Google), Mes listes avec statuts, favoris, priorité, progression.
- Design system dark-first + toggle thème, toggle langue des titres, responsive.
- À venir (liste simple triée par date).

**V2**
- Calendrier visuel complet (grille semaine/mois, countdown).
- Anime saisonnier avec navigation saison/année riche.
- Tags personnalisés + notes longues + filtres avancés multi-critères.
- Snapshots enrichis, recommandations croisées, statistiques perso.
- Notifications de sorties, partage de listes, import/export.

---

## 10. Risques techniques et solutions

| Risque | Solution |
|--------|----------|
| Rate limits AniList/TMDB | Cache TanStack Query + `staleTime` long, agrégation côté serveur, requêtes groupées, pagination. |
| Plateformes FR incohérentes entre sources | `watch/providers` TMDB région FR + table de correspondance interne pour anime (Crunchyroll/ADN). |
| Clé TMDB exposée | Stockée en secret Lovable Cloud, lue **uniquement** dans les server functions. |
| Fuite `service_role` / RLS | Données perso via `requireSupabaseAuth` (RLS user), jamais admin pour lecture app. |
| Loaders SSR appelant des fns protégées | Fns perso appelées côté composant/`_authenticated` seulement ; pages publiques → fns publiques (clé anon). |
| Identifiants médias instables | Clé composite `source:external_id` comme référence stable en base. |
| Données manquantes selon source | `MediaItem` tolérant (champs nullables) + `EmptyState`/fallbacks UI. |
| Désynchro snapshot vs source | Snapshot = affichage only ; la fiche détail refetch toujours la source. |
| Perf images posters | Lazy loading, tailles TMDB adaptées, `srcset`, skeletons. |

---

Ceci est le plan complet. Dès validation, je propose de démarrer par **le design system + la couche de normalisation + la page Découverte** comme première tranche, avant d'activer Lovable Cloud pour l'auth et les listes.