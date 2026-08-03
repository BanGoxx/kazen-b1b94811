# KAZEN

**Plateforme française premium de découverte et de suivi de médias** — animes, séries et films.
Interface 100 % française (FR/EN commutable), dark-mode « Aurora », données AniList + TMDB,
backend Lovable Cloud (Supabase).

- Production : <https://kazen.lovable.app>
- Preview : <https://id-preview--d81bc3c1-5965-4123-b3b6-b9e71c6d05eb.lovable.app>
- Projet Lovable : `d81bc3c1-5965-4123-b3b6-b9e71c6d05eb`

---

## Table des matières

| Document | Contenu |
| --- | --- |
| **README.md** (ce fichier) | Vue d'ensemble, démarrage rapide, arborescence |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, routage, frontières client/serveur, intégrations externes, cache |
| [docs/DATABASE.md](docs/DATABASE.md) | Schéma complet, RLS, rôles, RPC, migrations |
| [docs/FEATURES.md](docs/FEATURES.md) | Catalogue fonctionnel exhaustif, domaine par domaine |
| [docs/SECURITY.md](docs/SECURITY.md) | Modèle de menace, durcissements appliqués, règles permanentes |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Workflow, conventions, tests, checklist de PR |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Historique des phases, état actuel, travaux en attente |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Langage visuel Aurora, tokens, composants |
| [docs/production-smoke-test.md](docs/production-smoke-test.md) | Scénario de recette avant publication |
| [docs/phase-25-external-qa.md](docs/phase-25-external-qa.md) | Protocole de QA externe |
| [docs/spike-nautiljon-import.md](docs/spike-nautiljon-import.md) | Étude d'import Nautiljon |

Les rapports d'audit détaillés (phases 25 → H.2) vivent dans `.lovable/*.md`.

---

## Ce que fait KAZEN

1. **Découvrir** — accueil éditorial, catalogues anime / séries / films, saisons,
   calendrier des sorties, à-venir, recherche avancée, recommandations « Pour vous ».
2. **Suivre** — listes personnelles (en cours, terminé, prévu, abandonné, en pause),
   progression par épisode, notes, rewatch, statistiques et récap hebdomadaire.
3. **Partager** — playlists collaboratives, critiques et réponses, badges publics,
   profils membres publics.
4. **Échanger** — forum par catégories, messagerie privée 1-à-1, salons de chat en direct,
   notifications in-app et e-mails digest.
5. **Importer / exporter** — import MyAnimeList (XML), AniList, Nautiljon ; export JSON/CSV
   (portabilité RGPD).
6. **Assister** — assistant IA de recommandation (Lovable AI Gateway) avec quotas et cache.
7. **Modérer** — signalements, actions de modération tracées, requêtes de correction de fiche,
   rôles hiérarchiques.

Détail complet : [docs/FEATURES.md](docs/FEATURES.md).

---

## Stack

| Couche | Technologie |
| --- | --- |
| Framework | TanStack Start v1 (React 19, SSR) |
| Routeur | TanStack Router (routage par fichiers, `src/routes/`) |
| Build | Vite 8 + Nitro (cible Cloudflare Workers) |
| Données client | TanStack Query v5 |
| Styles | Tailwind CSS v4 (tokens dans `src/styles.css`) + shadcn/ui (Radix) |
| Backend | Lovable Cloud (Supabase : Postgres, Auth, Storage, RLS) |
| IA | Lovable AI Gateway (`src/lib/ai-gateway.server.ts`) |
| E-mail | Resend via `src/lib/email/provider.server.ts` |
| Tests | Vitest |
| Validation | Zod |

Sources externes : **AniList** (GraphQL, animes) et **TMDB** (séries/films), toutes deux
appelées **côté serveur uniquement**, avec file d'attente et cache Postgres.

---

## Démarrage rapide

```bash
bun install
bun run dev        # http://localhost:8080
```

Scripts :

```bash
bun run dev        # serveur de dev Vite
bun run build      # build de production (Nitro/Workers)
bun run build:dev  # build en mode développement
bun run preview    # prévisualisation du build
bun run lint       # ESLint
bun run format     # Prettier
bunx tsgo --noEmit # typecheck
bunx vitest run    # tests unitaires (70 tests)
```

### Variables d'environnement

`.env` est **auto-généré par Lovable Cloud** — ne pas l'éditer à la main.

| Variable | Portée | Rôle |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client | URL du backend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | clé publiable (RLS appliquée) |
| `VITE_SUPABASE_PROJECT_ID` | client | identifiant projet |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PROJECT_ID` | serveur | équivalents serveur |
| `LOVABLE_API_KEY` | serveur | passerelle IA |
| Secrets (TMDB, Resend, …) | serveur | gérés via les secrets Lovable, jamais commités |

Le project ref de production est `yzmkeceduhzqqqpyfmdd`. Toute opération de base doit
vérifier cette valeur avant écriture (garde anti-production, cf. `docs/SECURITY.md`).

---

## Arborescence

```
src/
  routes/                  # routage par fichiers (URL = nom de fichier)
    __root.tsx             # shell applicatif : head, providers, chrome
    index.tsx              # accueil
    anime.*, series, films # catalogues
    media.$source.$id.tsx  # fiche média (anilist|tmdb + id)
    communaute.*           # forum public
    _authenticated/        # sous-arbre protégé (gate dans route.tsx)
    api/chat.ts            # route serveur HTTP (streaming assistant)
  components/
    ui/                    # shadcn/ui — ne pas modifier sans raison
    media/ import/ community/ chat/ moderation/ ...
  lib/
    *.functions.ts         # server functions appelables depuis le client
    *.server.ts            # code strictement serveur (jamais importé au client)
    i18n/                  # dictionnaires FR/EN + provider
    import/                # parseurs MAL / AniList / Nautiljon + matching
    email/                 # rendu et envoi des e-mails
  integrations/supabase/   # clients générés — NE PAS ÉDITER
  styles.css               # tokens de design Tailwind v4
supabase/migrations/       # 78 migrations SQL versionnées
docs/                      # documentation projet
.lovable/                  # rapports de phase et audits
```

**Fichiers auto-générés à ne jamais éditer** : `src/routeTree.gen.ts`,
`src/integrations/supabase/{client,client.server,types,auth-middleware,auth-attacher}.ts`,
`.env`, `supabase/config.toml`.

---

## Conventions clés

- Toute l'UI produit est **en français** ; l'anglais passe par `src/lib/i18n`.
- **Aucune couleur en dur** (`text-white`, `bg-[#...]`) — uniquement des tokens sémantiques.
- Les appels aux API externes et aux secrets se font dans des **server functions**
  (`createServerFn`) ou des fichiers `*.server.ts`, jamais dans un composant.
- Chaque table publique a **RLS activée + GRANT explicites**.
- Les fiches détail doivent tendre vers une richesse type Nautiljon, sans sacrifier
  lisibilité ni performance (règle permanente du projet).

Détails : [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
