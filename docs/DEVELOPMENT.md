# KAZEN — Guide de développement

## 1. Environnement

```bash
bun install
bun run dev          # http://localhost:8080
```

| Commande | Usage |
| --- | --- |
| `bun run build` | build de production (Nitro → Cloudflare Workers) |
| `bun run build:dev` | build en mode développement (utile pour repérer les erreurs de prérendu) |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |
| `bunx tsgo --noEmit` | typecheck (préféré à `tsc --noEmit`) |
| `bunx vitest run` | tests unitaires |

`.env`, `supabase/config.toml`, `src/routeTree.gen.ts` et `src/integrations/supabase/*`
sont **auto-générés** : ne jamais les modifier à la main.

## 2. Conventions de code

### Routage
- Un fichier par route dans `src/routes/`. La chaîne de `createFileRoute("...")` doit
  correspondre exactement à l'ID généré (slashs, segment `_authenticated` inclus).
- Chaque route de contenu définit son propre `head()` : titre unique (< 60 car.),
  description (< 160 car.), `og:title`, `og:description`. `og:image` uniquement sur une
  feuille disposant d'une image absolue réelle — jamais sur `__root`.
- Un parent de route rend toujours `<Outlet />`, sans condition sur le pathname.

### Serveur
- `*.functions.ts` = coquille fine (imports, types, `createServerFn` exportés). Toute
  logique runtime part dans un `*.server.ts`, sinon le code splitting casse l'exécution.
- `process.env.X` se lit **dans** le `.handler()`, jamais au niveau module.
- Valider systématiquement les entrées avec Zod dans `.inputValidator()`.
- Runtime Workers : pas de `child_process`, `sharp`, `canvas`, ni dépendance native.

### Client
- Données : loader → `ensureQueryData(queryOptions)`, composant → `useSuspenseQuery`.
  Pas de `useEffect` + `fetch` pour une lecture initiale.
- Rien qui dépende du navigateur (localStorage, `Date` locale, `window`) ne doit
  influencer le premier rendu : différer en `useEffect` / `requestIdleCallback`.
- Bibliothèques uniquement navigateur : import dynamique derrière `<ClientOnly>`.

### Style
- **Uniquement des tokens sémantiques** (`bg-card`, `text-muted-foreground`, `aurora-text`…).
  Jamais `text-white`, `bg-black`, `bg-[#...]`.
- Composants `src/components/ui/*` = shadcn ; les personnaliser via variantes, pas en
  réécrivant le fichier.
- Animations discrètes, toutes neutralisées sous `prefers-reduced-motion`.
- Se référer à `DESIGN_SYSTEM.md` avant toute décision visuelle.

### Textes
- Toute chaîne visible passe par `src/lib/i18n` ; le français est la source de vérité,
  l'anglais suit dans `locales.ts`. Pas de texte en dur dans un composant.

## 3. Tests

Vitest, fichiers `*.test.ts` **à côté** de leur source (imports relatifs `./…`).
Couverture actuelle : 70 tests, centrés sur Import Canonicalization V2
(validation, orchestrateur, métriques, gate, UX de reprise).

```bash
bunx vitest run
bunx vitest run src/lib/import-canonical-v2.test.ts
```

Certains tests sont des assertions **statiques sur le code source** (lecture du fichier
et expressions régulières) : elles verrouillent des invariants d'UI et de sécurité qui ne
doivent pas régresser lors d'un refactor naïf. Ne pas les contourner — corriger le code.

## 4. Base de données

Toute évolution de schéma passe par une migration versionnée. Structure obligatoire :

```sql
CREATE TABLE public.ma_table (...);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ma_table TO authenticated;
GRANT ALL ON public.ma_table TO service_role;
-- GRANT SELECT ... TO anon;  -- uniquement si une policy autorise l'anonyme
ALTER TABLE public.ma_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY ... ;
```

Après migration, les types Supabase sont régénérés automatiquement — ne pas éditer
`src/integrations/supabase/types.ts`.

## 5. Workflow d'une phase

Le projet avance par « phases » documentées. Le schéma qui a fait ses preuves :

```text
1. AUDIT (lecture seule)     → constat chiffré, aucune écriture
2. CONCEPTION                → document .lovable/phase-*.md, options et risques
3. DÉCISION HUMAINE          → validation explicite avant toute écriture
4. IMPLÉMENTATION            → code + tests + migration + rollback
5. VÉRIFICATION              → typecheck, tests, build, audit du bundle
6. RAPPORT                   → verdict PASS / PARTIAL / BLOCKED dans .lovable/
7. PUBLICATION               → seulement après recette (docs/production-smoke-test.md)
```

Règles issues de l'expérience :
- Un audit ne modifie **rien**, ni code ni base.
- Une phase qui cible le mauvais environnement s'arrête immédiatement (verdict BLOCKED).
- Une migration candidate reste hors de `supabase/migrations/` tant qu'elle n'est pas revue.
- Un transfert de code entre environnements se fait par archive vérifiée par SHA-256.
- Chaque rapport de phase se termine par un bloc d'état :
  environnement / code modifié / base modifiée / migrations appliquées / déploiement.

## 6. Checklist avant de livrer

- [ ] `bunx tsgo --noEmit` vert
- [ ] `bunx vitest run` vert
- [ ] `bun run build` vert
- [ ] Nouvelles chaînes traduites FR + EN
- [ ] `head()` renseigné sur toute nouvelle route de contenu
- [ ] Aucun token de couleur en dur, contrastes WCAG AA vérifiés
- [ ] Aucun secret ni logique privilégiée dans le bundle client
- [ ] RLS + GRANT sur toute nouvelle table, rollback écrit
- [ ] Recette manuelle : `docs/production-smoke-test.md`
