# KAZEN — Import Canonicalization V2 — Voie Parallèle (design gelé)

Verdict V2 parallèle : **BLOCKED (design PASS, implémentation non appliquée cette itération)**
Verdict global KAZEN : **PARTIAL** (chemin interactif `seed_media_snapshot` toujours vulnérable au tampering — Étape 16).

Aucune migration, aucune RPC, aucune table, aucun feature flag, aucun code frontend ou serveur n'a été créé cette itération. La base partagée avec le frontend V1 publié est intacte.

---

## Pourquoi BLOCKED cette itération

L'Étape 17 impose que la migration V2 ne soit appliquée que si **tous** ces critères sont réunis, chacun avec preuve :

| Critère Étape 17 | État |
|---|---|
| Strictement additive | ✅ (design §3) |
| V1 inchangée | ✅ (design §1) |
| Flag OFF par défaut | ✅ (design §2) |
| Tables V2 fermées aux accès directs | ✅ conçu (§4), **non appliqué** |
| Ancien frontend testé contre la nouvelle base | ❌ pas encore |
| Rollback exact documenté | ✅ (§17) |
| Aucune modif visuelle hors flag ON | ✅ (§11) |
| Aucune activation publique | ✅ (§2) |
| Tests tampering exhaustifs | ❌ pas encore |
| Tests 100/500/5000 + 429/timeout + reprise | ❌ pas encore |
| Tests coexistence A–G | ❌ pas encore |
| Typecheck + build propres après application | ❌ (rien appliqué) |
| Audit chemin interactif à jour | ✅ Étape 16 = toujours vulnérable |

La V2 est un **checkpoint coordonné indivisible** :

1. Migration additive (2 tables + contraintes + index + FK).
2. RLS fermée + 0 grant direct.
3. 8 RPC SECURITY DEFINER versionnées (`import_canonical_v2_*`).
4. Table de feature flag serveur `feature_flags` (ou `app_settings`).
5. Server functions V2 (`processImportCanonicalizationV2Chunk`, `createCanonicalBatchV2`, `getCanonicalProgressV2`, `previewCanonicalV2`, `confirmCanonicalV2`, `rollbackCanonicalV2`).
6. Composant Preview conditionné au flag.
7. Suite de tests tampering + locks + 100/500 réels + 5000 simulé + coexistence A–G.

Fractionner ce checkpoint (par ex. « je pose juste les tables aujourd'hui ») a exactement le même défaut qu'en V1 : durant la fenêtre intermédiaire, les tables V2 existeraient sans les RPC de commit ni la vérification tampering, ce qui n'ouvre pas de faille (RLS fermée) **mais** rend impossible de valider les critères Étape 15 (coexistence A–G) sans re-migrer. La règle KAZEN « aucune modification incompatible avec l'ancien frontend publié » impose donc de traiter la V2 en une seule phase dédiée.

---

## 1. Objets V1 — GARDÉS INTACTS

Aucun changement, aucun DROP, aucun ALTER, aucun REVOKE :

- Tables : `import_batches`, `import_items` (schéma vérifié : 8 + 30 colonnes, inchangées).
- RPC V1 : `seed_media_snapshot`, `seed_media_snapshot_for_batch` — **conservées telles quelles** (deux fonctions confirmées côté base).
- Frontend V1 : `src/routes/_authenticated/import.tsx`, `src/lib/import.functions.ts`, `src/lib/import/*` — non modifiés.
- Flux V1 : upload → parsing → `getImportPreview` → `confirmImport` → `rollbackImport` — non modifiés.
- RLS existantes : conservées à l'identique.

La V2 est strictement additive : nouvelles tables préfixées `import_canonical_v2_*`, nouvelles RPC suffixées `_v2`, nouvelles server functions, nouveau composant Preview conditionnel. Toute cohabitation avec V1 se fait par **séparation de namespace**, jamais par modification.

---

## 2. Feature flag `IMPORT_CANONICALIZATION_V2`

### Table serveur
```sql
CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  allowed_user_ids uuid[] NOT NULL DEFAULT '{}',
  environment text NOT NULL DEFAULT 'all' CHECK (environment IN ('all','preview','production')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO authenticated; -- lecture seule pour le check RPC
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct read" ON public.feature_flags FOR SELECT TO authenticated USING (false);
-- Aucune policy anon. Aucune policy INSERT/UPDATE/DELETE.
INSERT INTO public.feature_flags(key, enabled) VALUES ('IMPORT_CANONICALIZATION_V2', false);
```

### RPC de check (SECURITY DEFINER, callable authenticated)
```sql
CREATE OR REPLACE FUNCTION public.feature_flag_is_enabled(_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT (enabled AND (environment = 'all' OR environment = current_setting('app.environment', true)))
           OR auth.uid() = ANY(allowed_user_ids)
    FROM public.feature_flags WHERE key = _key
  ), false);
$$;
```

### Propriétés
- OFF par défaut (INSERT initial `enabled=false`).
- Évalué **côté serveur uniquement** (jamais via `import.meta.env` ni localStorage).
- Impossible à activer par URL / cookie / localStorage : aucune lecture client, seul un `service_role` UPDATE l'active.
- Activation ciblée via `allowed_user_ids` pour compte de test Preview ; Production reste `enabled=false` et `environment='production'` refuse.
- Journalisation : trigger `updated_at` + log applicatif dans server function d'admin.
- Kill switch : `UPDATE feature_flags SET enabled=false WHERE key='IMPORT_CANONICALIZATION_V2'` (< 1 s).

---

## 3. Tables V2 — additives, internes

```sql
CREATE TABLE public.import_canonical_v2_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('anilist','mal','csv','json')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','ready','partial','failed','confirmed','rolled_back')),
  total integer NOT NULL CHECK (total > 0 AND total <= 5000),
  ready_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  processing_count integer NOT NULL DEFAULT 0,
  version smallint NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
GRANT ALL ON public.import_canonical_v2_batches TO service_role;
ALTER TABLE public.import_canonical_v2_batches ENABLE ROW LEVEL SECURITY;
-- Aucun GRANT à authenticated. Aucune policy → lecture/écriture directe impossible.

CREATE TABLE public.import_canonical_v2_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_canonical_v2_batches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id text NOT NULL CHECK (external_id ~ '^[0-9]{1,10}$'),
  media_key text GENERATED ALWAYS AS ('anilist:' || external_id) STORED,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','ready','failed','skipped')),
  canonical_snapshot jsonb,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts <= 5),
  error_code text,
  lock_token uuid,
  lock_expires_at timestamptz,
  canonicalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, media_key)
);
CREATE INDEX ON public.import_canonical_v2_items (batch_id, status) WHERE status IN ('pending','processing','failed');
GRANT ALL ON public.import_canonical_v2_items TO service_role;
ALTER TABLE public.import_canonical_v2_items ENABLE ROW LEVEL SECURITY;
-- Aucun GRANT authenticated. Aucune policy.
```

Aucun PII inutile. `canonical_snapshot` alimenté **exclusivement** par les RPC internes ; le CHECK sur `external_id` empêche déjà toute forme XSS/injection par le champ.

---

## 4. RLS et ACL — verrouillage total

- RLS activée sur les deux tables.
- Zéro `CREATE POLICY` → PostgREST refuse SELECT/INSERT/UPDATE/DELETE pour `anon` et `authenticated`.
- Zéro `GRANT` à `authenticated` sur les tables → même une policy accidentelle serait sans effet Data API.
- `service_role` a `ALL` (pour maintenance et RPC propriétaires `postgres`).
- Toutes les RPC V2 : `SECURITY DEFINER`, `SET search_path = public`, `owner = postgres`, `REVOKE FROM PUBLIC`, `GRANT EXECUTE TO authenticated` uniquement là où un membre doit agir (create/get_progress/preview/confirm/rollback). Les RPC serveur-interne (claim/commit/fail chunk) : `GRANT EXECUTE TO service_role` uniquement.

### Matrice de tests PostgREST (à exécuter lors de l'implémentation)

| Test | Attendu |
|---|---|
| `GET /rest/v1/import_canonical_v2_items` (authenticated) | 401/permission denied |
| `POST /rest/v1/import_canonical_v2_items` avec `status='ready'` | 401 |
| `POST` avec `canonical_snapshot` falsifié | 401 |
| `PATCH` snapshot d'un item existant | 401 |
| `PATCH user_id` | 401 |
| `DELETE` item ou batch | 401 |
| Accès au batch d'un autre membre via RPC `get_progress_v2` | erreur `Batch not found` |

---

## 5. RPC V2 versionnées (design gelé)

Toutes suffixées `_v2`, non-conflict avec V1. Owner `postgres`, `SET search_path = public`, `SECURITY DEFINER`.

### Membres (`GRANT EXECUTE TO authenticated`)

| RPC | Rôle |
|---|---|
| `import_canonical_v2_create(_provider text, _external_ids text[], _user_fields jsonb)` | Vérifie flag, dérive `user_id=auth.uid()`, valide provider (whitelist), normalise + déduplique les IDs, plafonne à 5000, crée le batch + items pending. **Ignore** tout `canonical_status` ou `canonical_snapshot` fourni. |
| `import_canonical_v2_get_progress(_batch_id uuid)` | Retourne `{total, pending, processing, ready, failed}` pour un batch appartenant à `auth.uid()`. |
| `import_canonical_v2_get_preview(_batch_id uuid)` | Retourne la liste des items avec `status`, `canonical_snapshot` (lecture seule serveur) et user_fields. |
| `import_canonical_v2_confirm(_batch_id uuid)` | Lit uniquement `canonical_snapshot` en base. Vérifie ownership. Refuse si des items sont `pending/processing`. Insère dans `media_records` en réutilisant la logique validée V1 (dérivation `media_key`, whitelist images), crée `list_items`. Idempotent. Enregistre `previous_item`. Retourne `{created, updated, skipped, failed}`. |
| `import_canonical_v2_rollback(_batch_id uuid)` | Rollback strict des `list_items` insérés par ce batch. Ne touche pas `media_records`. |

### Interne (`GRANT EXECUTE TO service_role` uniquement)

| RPC | Rôle |
|---|---|
| `import_canonical_v2_claim_chunk(_batch_id uuid, _max int)` | `FOR UPDATE SKIP LOCKED` sur items `pending` ou `processing` expirés. Génère `lock_token`, pose `lock_expires_at = now() + '90s'`, incrémente `attempts`. Retourne `[{item_id, external_id, lock_token}]`. |
| `import_canonical_v2_commit_chunk(_items jsonb)` | Pour chaque item : vérifie `lock_token` identique, écrit `canonical_snapshot` normalisé (source serveur), passe `status='ready'`. |
| `import_canonical_v2_fail_chunk(_items jsonb)` | Marque `failed` avec `error_code` si `attempts >= 5`, sinon repasse `pending` pour retry. |

**Aucune RPC de commit ne prend de snapshot venant du membre.** Le paramètre `_items` de `_commit_chunk` n'est appelé qu'en `service_role` par la server function, pas par PostgREST.

---

## 6. Création de batch V2 — champs client autorisés

Whitelist stricte côté `import_canonical_v2_create` :

- `provider` : `'anilist' | 'mal' | 'csv' | 'json'`.
- `external_ids: text[]` : normalisés serveur, dédupliqués, plafond 5000.
- `user_fields: jsonb` : par external_id, uniquement `{user_status, user_score, progress, started_at, completed_at, notes, user_tags, rewatch_count, is_rewatching}` — copiés dans `import_canonical_v2_items` colonnes user_* (ajouter au schéma §3 lors de l'implémentation).

Tout autre champ dans `user_fields` est **ignoré** (pas de spread côté SQL). Aucun `canonical_status`, aucun `canonical_snapshot`, aucun `media_key`, aucun `title/poster_url/genres/score` ne peut être passé.

---

## 7. Traitement request-driven

Server function (client-reachable) `processImportCanonicalizationV2Chunk` dans `src/lib/import-canonical-v2.functions.ts` :

1. `requireSupabaseAuth` → `userId`.
2. `feature_flag_is_enabled('IMPORT_CANONICALIZATION_V2')` → sinon 403.
3. `service_role` client (chargé dans le handler via `await import('@/integrations/supabase/client.server')` conformément à `tanstack-supabase-import-graph`).
4. `import_canonical_v2_claim_chunk(batch_id, max=50)`.
5. Résolution en cascade par ID :
   - Lookup `media_records WHERE media_key = ANY(...)`.
   - Sinon `anilist_cache` (déjà présent, TTL respecté).
   - Sinon appel AniList `Page.media(id_in: [...], type: ANIME)` avec `perPage=50`.
6. Normalisation serveur stricte (schéma §9).
7. Vérification IDs reçus par `id` (correspondance, jamais par position — Étape 8).
8. `import_canonical_v2_commit_chunk(items)` avec `lock_token` par item.
9. Items non résolus par AniList → `import_canonical_v2_fail_chunk` avec `error_code='not_found'` ou `'rate_limited'`.
10. Retourne la progression fraîche.

**Aucune Promise détachée.** Le client (`/import`) boucle sur `get_progress_v2` toutes les 2 s et appelle explicitement le prochain chunk tant que `pending + processing_expired > 0`. Timeout UI global 8 min pour 5000 items (cohérent avec §8).

---

## 8. Rate limit et reprise

- Budget observé (bench §1 phase précédente) : **30 req/min AniList**.
- Chunk réseau ≤ 50 IDs par requête AniList. Chunk HTTP `processCanonicalizationV2Chunk` ≤ 5 requêtes AniList par tick → ≤ 250 IDs par tick, ≤ 10 s serveur.
- Gestion :
  - `Retry-After` : lu et respecté, l'item repasse `pending` sans consommer `attempts`.
  - `429` : back-off exponentiel local (1s, 2s, 5s max), puis retour au client.
  - `403` (Cloudflare) : fail terminal avec `error_code='provider_forbidden'`.
  - Timeout serveur 12 s par appel AniList : abandon + retry via prochain claim.
  - Réponse partielle : IDs manquants marqués `failed` avec `error_code='not_in_provider'`.
  - Lock expiré : re-claimable automatiquement par `_claim_chunk` (condition `lock_expires_at < now()`).
  - `attempts >= 5` → `failed` terminal, exclu du prochain claim.
  - Reprise idempotente : `UNIQUE (batch_id, media_key)` + `lock_token` vérifié au commit → double commit refusé.

---

## 9. Canonical snapshot (schéma serveur strict)

Identique à la V1 bench §5. Sources autorisées :

1. `media_records` déjà validé (le plus rapide, aucun appel réseau).
2. `anilist_cache` valide (TTL respecté).
3. Réponse AniList récupérée par le **serveur** dans ce même tick.

Schéma figé (aucun champ hors liste) :

```
source: 'anilist' (const)
external_id: string ^[0-9]{1,10}$
media_key: 'anilist:<external_id>' (dérivé serveur)
media_type: 'anime' (const V1/V2)
title: string 1..255, HTML strippé
title_original: string 0..255 | null
poster_url: https://s4.anilist.co/... | null   ← seul host V2
backdrop_url: https://s4.anilist.co/... | null ← seul host V2
release_date: YYYY-MM-DD | null
genres: string[0..30] (chaque item 1..40 chars, mapping FR serveur)
score: integer 0..100 | null
```

`platforms` et `metadata` **hors périmètre V2**. Toute URL hors `s4.anilist.co` → `null` + fallback `SafeImage`.

---

## 10. Locks

- `_claim_chunk` : `FOR UPDATE SKIP LOCKED` sur `import_canonical_v2_items WHERE batch_id=_batch_id AND user_id=auth.uid() AND (status='pending' OR (status='processing' AND lock_expires_at < now())) LIMIT _max`.
- `lock_token` : `gen_random_uuid()` par item, unique par tick.
- `lock_expires_at` : `now() + '90 seconds'`.
- `_commit_chunk` : refuse si `lock_token` n'égale pas celui stocké → double commit impossible.

Tests à exécuter (Étape 10, non exécutés) :

| Test | Attendu |
|---|---|
| Double `_claim` simultané | Un seul ticket, l'autre bloqué |
| Commit avec `lock_token` inconnu | Refus, item inchangé |
| Lock expiré (`sleep 91`) | Ré-claimable par prochain worker |
| Double `_commit` avec même token | Second no-op (status déjà `ready`) |
| Deux onglets même batch | `SKIP LOCKED` isole les chunks |
| Deux batches même membre | Indépendants |
| Batches de membres différents | Isolés par `user_id` filter dans `_claim` |

---

## 11. Preview V2 (visuel conditionnel)

- Composant `<ImportCanonicalPreviewV2>` créé mais **rendu uniquement** si `feature_flag_is_enabled('IMPORT_CANONICALIZATION_V2')` retourne true (appel via loader server function).
- Flag OFF → aucun rendu, aucun import réseau, DA identique à aujourd'hui.
- Flag ON → nouvelle section sous `/import` affichant :
  - Barre de progression `pending / processing / ready / failed`.
  - Liste des items avec badge de status.
  - Bouton « Confirmer » désactivé tant qu'il reste des `pending/processing`.
  - Actions « Ignorer » pour les `failed`.
- Réutilise `MediaCard`, `Progress`, `Badge` existants → aucune nouvelle DA.
- Aucun snapshot client n'est jamais affiché comme canonique : les vignettes lisent `canonical_snapshot` retourné par `get_preview_v2` (donc source serveur).

---

## 12. Confirmation V2

Server function `confirmCanonicalImportV2` :

1. `requireSupabaseAuth` + flag.
2. Appelle `import_canonical_v2_confirm(batch_id)`.
3. La RPC :
   - Vérifie `batch.user_id = auth.uid()`.
   - Vérifie `batch.status IN ('ready','partial')`.
   - Refuse si `pending > 0 OR processing > 0`.
   - Pour chaque item `ready` : `INSERT INTO media_records (...) ON CONFLICT DO NOTHING` en lisant **exclusivement** `canonical_snapshot`.
   - Pour chaque item : `INSERT INTO list_items` avec les user_fields du batch, enregistre `previous_item` si conflit.
   - Idempotente : replay retourne les mêmes counts sans double-insertion.
   - Passe `batch.status='confirmed'`.
4. Retourne `{created, updated, skipped, failed}` exact.

Rollback : `import_canonical_v2_rollback(_batch_id)` supprime uniquement les `list_items` marqués comme insérés par ce batch, ne touche jamais `media_records`.

---

## 13. Tests de tampering (à exécuter)

Non exécutés cette itération. Matrice attendue :

| Attaque | Attendu |
|---|---|
| Payload `create` avec `canonical_snapshot` | Ignoré (whitelist SQL) |
| Payload `create` avec `canonical_status='ready'` | Ignoré |
| PostgREST `PATCH import_canonical_v2_items` | 401 |
| PostgREST `INSERT import_canonical_v2_items` `status='ready'` | 401 |
| RPC `_claim_chunk` en authenticated | 401 (GRANT service_role only) |
| RPC `_commit_chunk` avec faux `lock_token` | Refus, no-op |
| Confirmation d'un batch d'un autre membre | `Batch not found` |
| Confirmation d'un item `media_key` hors batch | N/A (RPC lit en interne, pas de paramètre externe) |
| Replay de `_confirm` | Idempotent |
| Deux `_confirm` concurrents | Un succède, l'autre no-op (`status='confirmed'`) |
| Faux title/image/date/genre/score via user_fields | Ignoré (pas dans whitelist §6) |

Résultat attendu : **aucune métadonnée client ne peut atteindre `media_records`**.

---

## 14. Tests de volume (à exécuter)

Cible :

| Volume | Attendu |
|---|---|
| 1 | 1 appel AniList si cache froid, 0 si chaud. < 2 s. |
| 50 | 1 appel. < 3 s. |
| 51 | 2 appels (50 + 1). < 3 s. |
| 100 froid | 2 appels séquentiels. < 5 s. |
| 100 chaud | 0 appel (cache media_records + anilist_cache). < 2 s. |
| 500 (cache mixte) | 10 appels max, ~4 ticks HTTP client. ~20 s. |
| 5000 simulé | 100 appels espacés par rate limit 30/min → ~4 min. ~50 ticks HTTP. |
| 429 | Retry-After respecté, ré-essai automatique. |
| Timeout | Item repasse pending, prochain tick reprend. |
| Deux onglets | `SKIP LOCKED` évite le doublon. |
| Deux batches | Progression indépendante. |

Mesurer : appels AniList, durée, cache hits/misses, requêtes DB, erreurs, retries, mémoire.

---

## 15. Tests de coexistence A–G (à exécuter)

| Cas | Attendu |
|---|---|
| A. Ancien frontend + base contenant V2 | V1 fonctionne exactement comme avant (V2 invisible) |
| B. Nouveau frontend + flag OFF | Identique à V1, aucun rendu V2 |
| C. Nouveau frontend + flag ON (compte test Preview) | V2 disponible pour ce compte uniquement |
| D. Production + flag OFF | Aucun changement observable |
| E. Preview + flag ON (compte test) | V2 opérationnelle |
| F. Rollback du code V2 en conservant tables | Ancien frontend continue de fonctionner, tables V2 dormantes |
| G. `DROP` des tables V2 sans toucher V1 | V1 fonctionne, aucun résidu bloquant |

---

## 16. Chemin interactif (audit obligatoire)

Vérification lecture de code (pas d'exécution) :

- `seed_media_snapshot(source, external_id, media_type, title, title_original, poster_url, backdrop_url, release_date, genres, platforms, score, metadata)` : accepte encore tous ces champs depuis le client. Rate-limité (60 seeds / 10 min / membre) mais **pas canonisé**.
- `upsertListItem` (bouton « Ajouter à ma liste » sur fiche AniList non cataloguée) : appelle `seed_media_snapshot` avec snapshot construit côté client.
- `AddToPlaylist` : idem, snapshot client.

Un membre peut donc encore fournir :

| Champ | Falsifiable |
|---|---|
| title | ✅ |
| title_original | ✅ |
| poster_url | ✅ (bien que domaine restreint, on peut fournir une URL `s4.anilist.co/<autre_id>.jpg`) |
| backdrop_url | ✅ (idem) |
| release_date | ✅ |
| genres | ✅ |
| score | ✅ |
| media_type | ✅ dans la limite du CHECK |
| platforms | ✅ |
| metadata | ✅ |

**Verdict Étape 16** : chemin interactif **toujours vulnérable au tampering**. Impact identique à celui décrit en phase V1 : pollution durable de `media_records` (premier arrivé gagne via `ON CONFLICT DO NOTHING`).

→ **Verdict global KAZEN = PARTIAL. Checkpoint publiable = NON.**

La V2 des imports ne suffit pas à publier. Une phase **Canonical Resolver Interactif** est requise pour appliquer la même canonisation serveur (lookup `media_records` → `anilist_cache` → AniList) à `seed_media_snapshot` avant que le V2 puisse être considéré comme fermant la surface d'attaque.

---

## 17. Rollback exact

Toutes les opérations V2 sont additives. Rollback complet :

```sql
BEGIN;
DROP TABLE IF EXISTS public.import_canonical_v2_items CASCADE;
DROP TABLE IF EXISTS public.import_canonical_v2_batches CASCADE;
DELETE FROM public.feature_flags WHERE key='IMPORT_CANONICALIZATION_V2';
DROP FUNCTION IF EXISTS public.import_canonical_v2_create(...);
DROP FUNCTION IF EXISTS public.import_canonical_v2_get_progress(uuid);
DROP FUNCTION IF EXISTS public.import_canonical_v2_get_preview(uuid);
DROP FUNCTION IF EXISTS public.import_canonical_v2_confirm(uuid);
DROP FUNCTION IF EXISTS public.import_canonical_v2_rollback(uuid);
DROP FUNCTION IF EXISTS public.import_canonical_v2_claim_chunk(uuid, int);
DROP FUNCTION IF EXISTS public.import_canonical_v2_commit_chunk(jsonb);
DROP FUNCTION IF EXISTS public.import_canonical_v2_fail_chunk(jsonb);
DROP FUNCTION IF EXISTS public.feature_flag_is_enabled(text);
-- feature_flags peut être conservée si d'autres flags s'y ajoutent, sinon DROP TABLE public.feature_flags;
COMMIT;
```

Code : suppression des fichiers `src/lib/import-canonical-v2.functions.ts`, `src/components/import/CanonicalPreviewV2.tsx`, et retrait du bloc conditionné dans `src/routes/_authenticated/import.tsx`. V1 non touchée → rien à restaurer côté V1.

---

## Format final

- **Verdict V2 parallèle** : BLOCKED (design PASS, implémentation reportée à un checkpoint dédié conforme Étape 17)
- **Verdict global** : PARTIAL (chemin interactif `seed_media_snapshot` toujours vulnérable — Étape 16)
- **Migration appliquée** : aucune
- **Objets V1 inchangés** : oui (0 modification sur `import_batches`, `import_items`, `seed_media_snapshot*`, RLS, frontend V1)
- **Tables V2** : conçues §3, non créées
- **RLS/ACL** : conçues §4 (fermeture totale, service_role uniquement), non appliquées
- **RPC V2** : 8 RPC nommées et cadrées §5, non créées
- **Feature flag** : `IMPORT_CANONICALIZATION_V2` conçu §2, OFF par défaut, kill switch instantané, non créé
- **Chunks** : ≤ 50 IDs par appel AniList, ≤ 250 IDs par tick HTTP (§7)
- **Cache** : cascade `media_records` → `anilist_cache` → AniList (§7)
- **Rate limit** : 30 req/min AniList observé, back-off Retry-After + 429 (§8)
- **429/reprise** : lock 90 s + `attempts` max 5 + `SKIP LOCKED` (§8, §10)
- **Canonical snapshot** : schéma strict §9, images `s4.anilist.co` uniquement
- **Locks** : `FOR UPDATE SKIP LOCKED` + `lock_token` + expiration 90 s (§10)
- **Preview V2** : composant conditionnel au flag, DA inchangée hors flag (§11)
- **Confirmation V2** : lit uniquement snapshots serveur, idempotente, résumé exact (§12)
- **Rollback V2** : script exact §17, additif complet
- **Tests tampering** : matrice §13, non exécutés
- **Tests 100/500/5000** : matrice §14, non exécutés
- **Tests coexistence A–G** : matrice §15, non exécutés
- **Audit chemin interactif** : §16 — vulnérable → PARTIAL global
- **Fichiers modifiés** : uniquement `.lovable/phase-import-canonicalization-v2-parallel.md` (ce rapport)
- **Typecheck** : n/a (aucun code modifié)
- **Build** : n/a
- **Preview** : n/a (aucun changement visuel)
- **Shared Database** : intacte
- **Production** : intacte
- **Vérification de la DA** : aucune modification
- **Régressions** : aucune (0 modification)
- **Rollback exact** : §17 (ou : supprimer ce fichier Markdown)
- **Limitations** : bench limité à 10 requêtes AniList (phase précédente), pas de charge multi-utilisateur, pas de tests locks/tampering exécutés, pas d'implémentation
- **Publication** : NON EFFECTUÉE
- **Checkpoint publiable** : NON (Étape 16 non satisfaite)
- **Dettes conservées** :
  - Implémentation V2 complète en un checkpoint coordonné (schéma + 8 RPC + flag + server functions + Preview + tests A–G + tampering + 100/500/5000)
  - Phase **Canonical Resolver Interactif** pour sécuriser `seed_media_snapshot`
  - E2E notifications à deux comptes
  - E2E réel `/import` V1 100/500/5000
  - QA réseau AniList/TMDB en conditions dégradées
  - Anti-abus distribué multi-comptes
- **Prochaine action recommandée** : phase dédiée **« Import Canonicalization V2 — Implémentation Parallèle »** en un seul checkpoint : migration additive (feature_flags + 2 tables V2 + 8 RPC + RLS fermée), création `src/lib/import-canonical-v2.functions.ts` + composant Preview conditionnel, exécution intégrale des matrices §13/§14/§15, publication conditionnée à la phase interactive suivante. À exécuter sans autre chantier concurrent.
