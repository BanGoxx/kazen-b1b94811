# KAZEN — Architecture

## 1. Vue d'ensemble

```text
 Navigateur (React 19)
    │  TanStack Router + TanStack Query
    │
    ├─ server functions (createServerFn)  ── RPC typé, même origine
    │
 SSR / Worker (Nitro → Cloudflare Workers)
    │
    ├─ Supabase (Postgres + Auth + RLS + Storage)   ← source de vérité
    ├─ AniList GraphQL      (animes)   ── file d'attente + cache Postgres
    ├─ TMDB REST            (séries/films) ── cache Postgres
    ├─ Lovable AI Gateway   (assistant, recommandations)
    └─ Resend               (e-mails digest / transactionnels)
```

Le client ne parle jamais directement à AniList, TMDB, l'IA ou Resend : ces intégrations
détiennent des secrets et vivent exclusivement dans le runtime serveur.

## 2. Routage

Routage par fichiers TanStack Router. Le nom du fichier définit l'URL ; les points
deviennent des slashs ; `$param` est un segment dynamique ; `_authenticated` est un
segment de layout (invisible dans l'URL).

### Routes publiques

| Fichier | URL | Rôle |
| --- | --- | --- |
| `index.tsx` | `/` | accueil éditorial (héros rotatif, bandes catégories, pour-vous) |
| `anime.tsx` + `anime.index.tsx` | `/anime` | catalogue anime paginé |
| `anime.saison.tsx` | `/anime/saison` | navigation par saison |
| `series.tsx` / `films.tsx` | `/series`, `/films` | catalogues TMDB |
| `calendrier.tsx` | `/calendrier` | calendrier des diffusions |
| `a-venir.tsx` | `/a-venir` | sorties à venir |
| `recherche.tsx` | `/recherche` | recherche multi-source + filtres |
| `pour-vous.tsx` | `/pour-vous` | rails de recommandations |
| `media.$source.$id.tsx` | `/media/anilist/123` | **fiche détail** (source + id) |
| `franchise.$source.$id.tsx` / `univers.$source.$id.tsx` | `/franchise/…`, `/univers/…` | regroupements |
| `entite.$kind.$id.tsx` | `/entite/:kind/:id` | personne, studio, personnage |
| `actualites.index.tsx` / `actualites.$slug.tsx` | `/actualites` | actualités éditoriales |
| `listes.tsx` | `/listes` | listes publiques de la communauté |
| `playlist.$id.tsx` | `/playlist/:id` | playlist partagée |
| `membre.$id.tsx` | `/membre/:id` | profil public |
| `communaute.index.tsx`, `.c.$slug`, `.t.$id`, `.nouveau` | `/communaute…` | forum |
| `auth.tsx` | `/auth` | connexion / inscription |
| `soutien.tsx` | `/soutien` | soutien / premium |
| `cgu`, `confidentialite`, `mentions-legales`, `regles-communautaires` | légal |
| `desabonnement.tsx` | `/desabonnement` | désinscription e-mail (token signé) |
| `sitemap[.]xml.ts` | `/sitemap.xml` | sitemap généré |

### Routes protégées (`src/routes/_authenticated/`)

Le gate vit dans `_authenticated/route.tsx` : session absente → redirection `/auth`.

| Fichier | URL | Rôle |
| --- | --- | --- |
| `mes-listes.tsx` | `/mes-listes` | listes de suivi personnelles |
| `mes-playlists.tsx` | `/mes-playlists` | playlists possédées / collaborées |
| `profil.tsx` | `/profil` | profil, confidentialité, préférences, suppression de compte |
| `statistiques.tsx` | `/statistiques` | statistiques de visionnage |
| `recap.tsx` | `/recap` | récap hebdomadaire |
| `notifications.tsx` | `/notifications` | centre de notifications |
| `messages.tsx` | `/messages` | messagerie privée 1-à-1 |
| `communaute.direct.tsx` | `/communaute/direct` | salons de chat en direct |
| `import.tsx` | `/import` | import MAL / AniList / Nautiljon + export |
| `moderation.tsx` | `/moderation` | file de modération (rôle requis) |
| `fondateur.tsx` | `/fondateur` | outils fondateur (owner) |

### Route serveur HTTP

`src/routes/api/chat.ts` — endpoint de streaming pour l'assistant IA.
Les webhooks/API externes iraient sous `src/routes/api/public/*` (aucun à ce jour).

## 3. Frontières client / serveur

| Suffixe | Nature | Importable par le client ? |
| --- | --- | --- |
| `*.functions.ts` | déclarations `createServerFn` (RPC typé) | oui — c'est la frontière |
| `*.server.ts` | logique serveur, secrets, SDK privilégiés | **non** (bloqué par le bundler) |
| autres `.ts/.tsx` | isomorphe | oui |

Règle : un fichier `*.functions.ts` reste une coquille fine (imports, types, déclarations
exportées). Toute logique runtime part dans un `*.server.ts` importé, sinon le code
splitting supprime les helpers et provoque un `ReferenceError` à l'exécution.

Server functions principales : `discover`, `list`, `stats`, `recap`, `recommend`,
`entity`, `enrichment`, `import`, `import-canonical-v2`, `export`, `chat`, `live-chat`,
`assistant-chat`, `notifications`, `moderation`, `founder`, `beta-feedback`,
`email-prefs`, `email-delivery`, `unsubscribe`, `playlist-reviews`, `forum-cover`,
`ai-usage`.

### Clients Supabase

| Client | Usage | RLS |
| --- | --- | --- |
| `@/integrations/supabase/client` | navigateur | appliquée (session utilisateur) |
| `context.supabase` via `.middleware([requireSupabaseAuth])` | server fn authentifiée | appliquée en tant qu'utilisateur |
| client publiable créé dans un handler | lectures publiques serveur | appliquée en tant qu'`anon` |
| `client.server` (admin) | opérations privilégiées, après vérification du rôle | **contournée** |

`src/start.ts` enregistre le `functionMiddleware` qui attache le jeton porteur aux
appels de server functions protégées.

## 4. Intégrations externes

### AniList (`src/lib/anilist.server.ts`, `anilist-shared-queue.server.ts`)

- GraphQL public, mais fortement rate-limité (429) et parfois protégé par Cloudflare (403).
- Mitigations : file d'attente partagée côté serveur (créneaux séquentiels), backoff,
  cache Postgres `anilist_cache` (RPC `anilist_cache_get` / `anilist_cache_put`),
  et repli navigateur `src/lib/anilist-public.ts` pour les cas de blocage 403.

### TMDB (`src/lib/tmdb.server.ts`)

- REST avec clé secrète serveur ; séries, films, crédits, vidéos, images, plateformes.
- Les résultats enrichis sont persistés dans `media_enrichments` / `media_records`.

### Lovable AI Gateway (`src/lib/ai-gateway.server.ts`)

- Assistant conversationnel + recommandations. Quotas par utilisateur
  (`ai_assistant_usage`, RPC `ai_assistant_reserve` / `_finalize` / `_my_quota`) et cache
  de réponses (`ai_assistant_cache`, RPC `_try` / `_poll` / `_store` / `_release`)
  versionné par `prompt_version` et `catalogue_version`.

### Resend (`src/lib/email/`)

- `provider.server.ts` (envoi), `render-digest.ts` (rendu), `eligibility.ts` (droit d'envoi),
  `unsub-token.server.ts` (jeton de désinscription signé). Journalisation dans
  `email_delivery_logs`.

## 5. Données et cache

- **Chargement** : loader de route → `context.queryClient.ensureQueryData(queryOptions)`,
  composant → `useSuspenseQuery`. Politiques centralisées dans `src/lib/queries.ts`.
- **Persistance de navigation** : `src/lib/catalog-state.ts` mémorise filtres, tri et
  position de scroll par session (retour arrière depuis une fiche sans perte d'état).
- **Cache serveur** : `anilist_cache` et `media_enrichments` évitent de retaper les API
  externes ; le suivi utilisateur vit dans `list_items`.
- **Hydratation** : toute lecture dépendante du navigateur (stockage local, dates locales)
  est différée en `useEffect` / `requestIdleCallback` pour éviter les mismatchs SSR.

## 6. Internationalisation

`src/lib/i18n/index.tsx` fournit le provider et le hook de traduction ;
`locales.ts` contient les dictionnaires FR (référence) et EN ; `date.ts`, `errors.ts` et
`tracking.ts` couvrent les formats et libellés dérivés. Le sélecteur de langue est dans
`src/components/layout/LanguageSelector.tsx`. Le français est la langue par défaut et la
source de vérité : toute nouvelle chaîne s'ajoute d'abord en FR.

## 7. Runtime de production

Le serveur tourne sur Cloudflare Workers (`workerd`) : pas de `child_process`, pas de
`sharp`/`canvas`, pas de dépendance native. Tout doit être bundlé au build ; aucune
résolution de module à l'exécution. `src/server.ts` enveloppe l'entrée SSR pour la
capture d'erreurs (`src/lib/error-capture.ts`, `lovable-error-reporting.ts`).
