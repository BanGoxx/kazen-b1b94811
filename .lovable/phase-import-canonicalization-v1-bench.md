# KAZEN — Import Canonicalization V1 — Bench + Design Gate

Verdict V1 : **BLOCKED (bench PASS, implémentation non appliquée cette itération)**
Verdict global KAZEN : **PARTIAL** (le chemin interactif `seed_media_snapshot` + `upsertListItem` reste vulnérable au même tampering ; tant qu'il n'est pas fermé, KAZEN n'est pas publiable).

Aucune migration, aucune RPC, aucun changement de schéma, aucun changement de code frontend n'a été effectué. La base partagée avec le frontend publié est intacte.

---

## 1. Bench AniList `Page.media(id_in:[Int], type: ANIME)` — réseau réel

Script isolé : `/tmp/bench/anilist-bench.mjs` (hors projet, sans dépendances internes).
Endpoint : `https://graphql.anilist.co`. Requête via `POST` JSON, sans clé.

| Scénario | perPage | IDs | Retour | Missing | Statut | Durée | Rate-limit restant |
|---|---|---|---|---|---|---|---|
| 1 ID | 50 | 1 | 1 | 0 | 200 | 352 ms | 29 / 30 |
| 10 IDs | 50 | 10 | 10 | 0 | 200 | 176 ms | 28 / 30 |
| 50 IDs | 50 | 50 | 48 | 2 (IDs inexistants) | 200 | 380 ms | 27 / 30 |
| 51 IDs, appel unique perPage=50 | 50 | 51 | 48 | 3 | 200 | 361 ms | 26 / 30 |
| 51 IDs, chunk 50+1 | 50 | 50 puis 1 | 48 + 0 | 2 + 1 | 200 | 339 + 144 ms | — |
| 100 IDs cold (2×50) | 50 | 100 | 48 + 19 | 33 | 200 | **1 292 ms total** | 22 / 30 |
| 100 IDs warm (mêmes) | 50 | 100 | 48 + 19 | 33 | 200 | 1 277 ms total | 20 / 30 |

Notes réelles observées :

- **perPage maximal utile : 50.** Un appel avec 51 IDs et `perPage:50` ne retourne que 48 items (les IDs excédentaires ne sont pas paginés ; ils sont silencieusement tronqués). Il faut chunker à 50 côté serveur.
- **IDs absents.** AniList ne lève pas d'erreur pour un ID inexistant, il l'omet simplement du tableau `media`. La correspondance doit se faire **par `media.id`, jamais par position**.
- **Ordre.** Non garanti d'être identique à l'ordre d'entrée. Confirmé : correspondre par ID.
- **Doublons.** Aucun doublon renvoyé par l'endpoint.
- **Rate limit.** L'endpoint annonce actuellement `x-ratelimit-limit: 30` requêtes / minute (dégradé par rapport à l'ancien 90). Aucun 429 rencontré dans le bench (10 appels espacés). C'est le **facteur de gate le plus contraignant** pour la V1.
- **Hosts d'images retournés.** Uniquement `s4.anilist.co` sur cet échantillon (cover + banner). Pas de `media.kitsu.io`, pas de `cdn.myanimelist.net`. Conforme à l'Étape 10 : la V1 doit **uniquement** autoriser `s4.anilist.co` (déjà utilisé partout dans KAZEN).
- **Cache chaud vs froid.** Il n'existe pas de cache côté AniList — les deux passes 100 IDs ont donné la même latence (~1,3 s). Le seul gain « warm » viendra de `public.anilist_cache` + de `public.media_records` côté KAZEN.
- **Champs disponibles** : `id`, `title{romaji,english,native}`, `coverImage{extraLarge,large}`, `bannerImage`, `startDate{y,m,d}`, `genres`, `averageScore`, `episodes`, `duration`, `externalLinks{site,url}`, `isAdult`. Suffisants pour construire un `canonical_snapshot` conforme au schéma strict de l'Étape 9.
- **Erreurs.** Aucun 429, aucun 403, aucun timeout observé. Le bench reste bref (10 requêtes) et ne prouve pas la robustesse sous forte charge — c'est cohérent avec la stratégie request-driven chunkée.

### Extrapolation performance
- 100 IDs cold : ~1,3 s réseau, 2 requêtes → tient très largement dans un chunk HTTP unique.
- 500 IDs : 10 requêtes, ~7 s minimum en séquentiel avec espacement ~600 ms — nécessite **3–4 appels `processCanonicalizationChunk` répartis** pour rester sous 5 s serveur chacun.
- 5 000 IDs : 100 requêtes AniList = **200 s minimum avec 30 req/min** de budget rate-limit → **~4 minutes incompressibles** même parfaitement chunkées. Doit rester request-driven avec relance client + reprise idempotente. Aucune tâche détachée.

**Gate bench : PASS.** Le batch 100 IDs froid est fiable et déterministe. Le bench autorise à concevoir la V1, mais **impose** :

1. Chunk réseau ≤ 50 IDs par requête AniList.
2. Correspondance par ID, pas par position.
3. Un seul host d'images en whitelist V1 : `s4.anilist.co`.
4. Rate limit 30/min → chunk HTTP côté client dimensionné pour ~5 appels AniList max (≤ 250 IDs) par tick, avec back-off `Retry-After` obligatoire.
5. 5 000 IDs ne peut pas se faire en un seul HTTP long : la V1 doit assumer une durée totale ~4–8 minutes en tick client.

---

## 2. Pourquoi l'implémentation V1 n'est pas appliquée cette itération

L'Étape 16 conditionne l'application à l'ensemble suivant *tous* réunis, chacun avec preuve :

| Prérequis | État |
|---|---|
| Bench 100 cold OK | ✅ (ci-dessus) |
| Architecture request-driven définie | ✅ (Section 3) |
| Séparation DB/réseau claire | ✅ (Section 3) |
| Schéma additif conçu | ✅ (Section 4) mais **non appliqué** |
| RPC versionnées (`*_v2`) écrites + testées | ❌ pas encore |
| INSERT/UPDATE internes verrouillés + test PostgREST | ❌ pas encore |
| Backfill déterministe des batches existants | ❌ pas encore |
| Compatibilité ancien frontend prouvée | ❌ non prouvée hors design |
| Rollback exact documenté | ✅ (Section 12) |
| Reprise/locks testés (worker interrompu, double claim, mauvais token, deux onglets) | ❌ pas encore |
| Tests tampering exhaustifs (Étape 14) | ❌ pas encore |
| Tests 100/500/5000 + 429/timeout | ❌ pas encore |
| Typecheck + build propres | ❌ (aucune modif faite) |
| DA inchangée | ✅ (aucune modif faite) |

Le projet partage sa base avec **le frontend publié**. Appliquer partiellement le schéma (par exemple les colonnes `canonical_*` sans encore la protection INSERT/UPDATE ni les RPC V2) créerait une fenêtre où :

- les colonnes internes seraient présentes mais forgeables par PostgREST via l'ancienne policy `INSERT/UPDATE ON import_items` — la vulnérabilité serait *aggravée*, pas fermée ;
- ou bien la protection serait appliquée mais casserait `getImportPreview` / `confirmImport` de l'ancien frontend qui insère `media_snapshot` directement.

L'application partielle est donc **techniquement plus dangereuse** que le report. Conforme à la règle « aucune migration incompatible avec l'ancien frontend ».

---

## 3. Architecture request-driven retenue (design gelé, non implémenté)

Aucun `setTimeout`/`Promise` détaché dans une server function. Aucun worker cron. Pas d'appel réseau depuis PostgreSQL.

```
Client (/import)
  └─► getCanonicalizationProgress (server fn, GET-like)         ── DB uniquement
        └─► retourne { total, ready, failed, pending, processing_expired }

  └─► si pending > 0 ou processing_expired > 0 :
        processCanonicalizationChunk (server fn, POST)
          1. requireSupabaseAuth → userId
          2. RPC import_canonical_claim_chunk_v1(batch_id, max_items=50)
               – FOR UPDATE SKIP LOCKED sur import_items du batch appartenant à userId
               – filtre canonical_status IN ('pending','failed')
                 OU (canonical_status='processing' AND canonical_lock_expires_at < now())
               – UPDATE canonical_status='processing',
                        canonical_lock_token=gen_random_uuid(),
                        canonical_lock_expires_at=now()+interval '90 seconds',
                        canonical_attempts=canonical_attempts+1
               – RETURNS (item_id, external_id, lock_token)[]
          3. côté server fn : batch d'IDs unique → 1 appel AniList perPage=50 max
             (avec back-off Retry-After + retry 429/5xx borné, timeout 12 s par appel)
          4. normalisation stricte (Section 5)
          5. RPC import_canonical_commit_chunk_v1(items: jsonb[])
               – vérifie lock_token identique par item
               – vérifie item.batch appartient à userId
               – écrit canonical_snapshot, canonical_source='anilist',
                        canonical_status='ready' | 'failed',
                        canonical_error_code, canonicalized_at
               – ne peut pas modifier user_id/batch_id/matched_media_key/media_snapshot
          6. retourne progression mise à jour

Client boucle jusqu'à pending=0 && processing_expired=0. Timeout global côté UI : 8 min.
```

**Aucun** processus ne survit après la réponse HTTP. Un worker interrompu est nettoyé par `canonical_lock_expires_at`. Le double claim est empêché par `FOR UPDATE SKIP LOCKED + lock_token` vérifié au commit.

**Confirmation** (post-canonisation) : nouvelle RPC `seed_media_snapshot_for_batch_v2` qui lit `canonical_snapshot` **côté SQL** et ignore intégralement le paramètre snapshot venu du client. Refuse si `canonical_status <> 'ready'`. L'ancienne RPC `seed_media_snapshot_for_batch` reste en place, **non modifiée**, pour l'ancien frontend.

---

## 4. Schéma additif à appliquer (draft SQL, non exécuté)

À **appliquer ultérieurement** dans une migration dédiée quand toutes les RPC V2 et le frontend V2 sont prêts et testés :

```sql
-- import_items
ALTER TABLE public.import_items
  ADD COLUMN canonical_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN canonical_snapshot jsonb,
  ADD COLUMN canonical_source text,
  ADD COLUMN canonicalized_at timestamptz,
  ADD COLUMN canonical_error_code text,
  ADD COLUMN canonical_attempts smallint NOT NULL DEFAULT 0,
  ADD COLUMN canonical_lock_token uuid,
  ADD COLUMN canonical_lock_expires_at timestamptz,
  ADD CONSTRAINT import_items_canonical_status_chk
    CHECK (canonical_status IN ('pending','processing','ready','failed','not_applicable'));

CREATE INDEX import_items_canonical_status_idx
  ON public.import_items (batch_id, canonical_status)
  WHERE canonical_status IN ('pending','processing','failed');

-- import_batches
ALTER TABLE public.import_batches
  ADD COLUMN canonical_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN canonical_total integer,
  ADD COLUMN canonical_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN canonical_started_at timestamptz,
  ADD COLUMN canonical_completed_at timestamptz,
  ADD CONSTRAINT import_batches_canonical_status_chk
    CHECK (canonical_status IN ('pending','processing','ready','failed','not_applicable','completed_with_skips','needs_review'));
```

### Backfill déterministe (Étape 4)

Critère exact, sans heuristique temporelle :

```sql
UPDATE public.import_items
SET canonical_status = 'not_applicable'
WHERE match_status IN ('applied','skipped','rolled_back')
   OR applied_at IS NOT NULL;
```

Justification : ces batches sont déjà consommés par l'ancien flux ; ils ne repasseront jamais par la V2 (qui gate sur `canonical_status='ready'`). Aucune ligne ne doit rétroactivement bloquer un batch clos.

Pour les batches *en cours* au moment de la migration (`status='previewed'`), on laisse `canonical_status='pending'` — l'ancien frontend continue à les confirmer via l'ancienne RPC. Ce risque de transition est traité en Section 6.

---

## 5. Schéma strict `canonical_snapshot` (Étape 9)

```
{
  source:         'anilist'                       (const, requis)
  external_id:    string, regex ^[0-9]{1,10}$     (requis)
  media_key:      'anilist:<external_id>'         (dérivé serveur)
  media_type:     'anime'                         (const V1)
  title:          string 1..255, tags HTML strippés (requis)
  title_original: string 0..255 | null            (fallback native/romaji)
  poster_url:     https://s4.anilist.co/... | null
  backdrop_url:   https://s4.anilist.co/... | null
  release_date:   YYYY-MM-DD | null
  genres:         string[] 0..30, chaque item 1..40 chars, mappage FR appliqué serveur
  score:          integer 0..100 | null (averageScore AniList)
}
```

- **`platforms` et `metadata` exclus de la V1** (schéma non figé). Ils resteront alimentés par le flux existant lors de l'enrichissement post-media_records si besoin — sans passer par le snapshot canonique.
- Toute image dont le host ≠ `s4.anilist.co` → `null` + fallback existant (`SafeImage`).
- Tout champ hors schéma dans la réponse AniList est **ignoré** (pas de spread `...m`).

---

## 6. Compatibilité ancien frontend & risque de transition (Étape 7)

- Ancien frontend publié : `getImportPreview` insère `import_items` avec `media_snapshot` client + `matched_media_key`. Puis `confirmImport` appelle `seed_media_snapshot_for_batch` (V1 existante). Aucune colonne `canonical_*` référencée.
- Nouvelle base après migration V1 : les nouvelles colonnes existent avec `DEFAULT 'pending'`. L'ancien frontend continue à écrire uniquement les champs qu'il connaît → `canonical_status='pending'` reste sans effet tant que l'ancien `confirmImport` utilise l'ancienne RPC.
- **Point critique** : si l'ancien frontend crée un batch après la migration, il consommera l'ancienne RPC vulnérable. → La vulnérabilité **reste ouverte** tant que l'ancien frontend est publié.
- Nouveau frontend (à publier ensemble) : passe uniquement par les RPC V2 et par `seed_media_snapshot_for_batch_v2`. À ce moment-là, on peut planifier le retrait de l'ancienne RPC.

**Durée max de coexistence tolérée : 1 checkpoint de publication.** Au-delà, la surface d'attaque de `seed_media_snapshot_for_batch` v1 reste exploitable en production.

**Ordre de publication futur** :

1. Appliquer migration additive (colonnes + CHECK + backfill).
2. Créer RPC V2 (claim/commit/preview_v2/confirm_v2), **sans toucher aux RPC V1**.
3. Verrouiller INSERT/UPDATE colonne-par-colonne sur `import_items` (voir Section 8).
4. Frontend V2 publié — passe intégralement par les RPC V2.
5. Checkpoint publication : REVOKE + DROP de `seed_media_snapshot_for_batch` v1 et `seed_media_snapshot` v1.

---

## 7. Verrouillage INSERT/UPDATE (Étapes 5 & 8, design non appliqué)

Aujourd'hui les policies sur `import_items` autorisent probablement un `INSERT`/`UPDATE` complet par l'utilisateur (à confirmer lors de la migration réelle). La V1 doit :

- **Retirer** les policies `INSERT` et `UPDATE` directes sur `import_items` pour `authenticated`.
- **Conserver** la policy `SELECT` (le frontend a besoin de lire la Preview).
- **Créer** des RPC SECURITY DEFINER dédiées avec filtre `_user_id = auth.uid()` :
  - `import_batch_create_v2(...)` — crée batch + items en un appel, sans laisser le client choisir `matched_media_key`/`media_snapshot` internes.
  - `import_item_set_user_choice_v1(item_id, action, target_media_key)` — permet à l'utilisateur de choisir « créer », « lier à un média existant », « ignorer » sur un item donné. **Ne touche pas** aux colonnes canoniques.
  - `import_canonical_claim_chunk_v1(batch_id, max_items)`.
  - `import_canonical_commit_chunk_v1(items jsonb)`.
  - `seed_media_snapshot_for_batch_v2(batch_id, item_id)` — lit `canonical_snapshot` en interne.

**Test PostgREST obligatoire avant PASS** (non exécuté cette itération) :

```
POST /rest/v1/import_items
{ user_id: <victime>, batch_id: <legit>, canonical_status: 'ready',
  canonical_snapshot: {...}, applied_action: 'created', previous_item: {...} }
→ attendu : 401/403 (policy INSERT retirée)
```

---

## 8. Audit du chemin interactif (Étape 15)

Le même tampering existe sur le chemin non-import :

- `seed_media_snapshot(source, external_id, media_type, title, title_original, poster_url, backdrop_url, release_date, genres, platforms, score, metadata)` : accepte tous ces champs depuis le client, dérive `media_key` serveur, applique `ON CONFLICT DO NOTHING`. Un membre peut créer une entrée `anilist:<id>` avec de fausses métadonnées **avant** que le vrai import ne l'insère ; premier arrivé gagne.
- Chemin déclenché : `upsertListItem` (bouton « Ajouter à ma liste » sur une fiche AniList non encore cataloguée) + « Ajouter à une playlist » — tous appellent `seed_media_snapshot` avec un snapshot construit côté client à partir de la fiche AniList.

Impact identique : pollution durable de `media_records`. **Le projet reste PARTIAL** tant que ce chemin n'a pas de canonisation équivalente (V2 réutilisant `import_canonical_claim_chunk_v1` / `_commit_v1` comme résolveur commun).

---

## Format final

- **Verdict V1** : BLOCKED — bench PASS, aucune implémentation appliquée (Étape 16 non satisfaite en un seul tour sans risquer l'ancien frontend).
- **Verdict global** : PARTIAL (le chemin interactif `seed_media_snapshot` reste vulnérable).
- **Bench AniList 1/10/50/51/100** : PASS, mesures dans le tableau §1. perPage réel = 50. Rate limit = 30/min.
- **Architecture request-driven** : figée §3.
- **Séparation DB/réseau** : §3 (SQL ne fait jamais d'appel AniList).
- **Schéma appliqué** : aucun (draft §4).
- **Backfill** : critère déterministe défini §4, non exécuté.
- **Protection INSERT** : conçue §7, non appliquée.
- **Protection UPDATE** : idem.
- **RPC versionnées** : nommage figé §3/§7, non créées.
- **Compatibilité ancien frontend** : conservée intégralement (aucun changement).
- **Risque de transition** : §6 — l'ancien `seed_media_snapshot_for_batch` reste vulnérable jusqu'au checkpoint de publication du frontend V2.
- **Canonical snapshot** : schéma strict §5.
- **Domaines d'images** : whitelist V1 = `s4.anilist.co` uniquement (mesuré).
- **Claim/commit/locks** : design §3 (FOR UPDATE SKIP LOCKED + lock_token + expiration 90 s).
- **Tests 100/500/5000** : non exécutés (bloqués par l'absence de schéma V1).
- **Tests 429/timeout/reprise** : non exécutés.
- **Tests tampering** : non exécutés.
- **Confirmation V2** : conçue §3/§6, non créée.
- **Résumé/rollback** : conservé tel quel (rollbackImport intact).
- **Audit chemin interactif** : §8 — vulnérable, PARTIAL global.
- **Migrations** : aucune appliquée cette itération.
- **RLS/ACL** : inchangées.
- **Fichiers modifiés** : uniquement `.lovable/phase-import-canonicalization-v1-bench.md` (ce rapport) + `/tmp/bench/anilist-bench.mjs` (hors projet).
- **Typecheck** : n/a (aucun code modifié).
- **Build** : n/a.
- **Preview** : n/a (aucun changement visuel).
- **Shared Database** : intacte.
- **Production** : intacte.
- **Vérification de la DA** : aucun changement.
- **Régressions** : aucune (0 modification).
- **Rollback exact** : n/a — rien à annuler. Le fichier de rapport peut être supprimé si besoin.
- **Limitations** : bench limité à 10 requêtes AniList, pas de charge multi-utilisateur, pas de test 429 forcé, pas d'implémentation.
- **Publication** : NON EFFECTUÉE.
- **Checkpoint publiable** : NON. Deux vulnérabilités actives (`seed_media_snapshot_for_batch` v1 + `seed_media_snapshot` v1). Ne pas publier avant Import V2 + interactif V2.
- **Dettes conservées** :
  - Implémentation V1 complète (schéma + RPC V2 + verrouillage + backfill + frontend V2 + tests).
  - Sécurisation du chemin interactif (`seed_media_snapshot`).
  - E2E réel `/import` 100/500/5000.
  - E2E notifications à deux comptes.
  - QA réseau AniList/TMDB en conditions dégradées.
  - Anti-abus distribué multi-comptes.
- **Prochaine action recommandée** : phase dédiée **« Import Canonicalization V1 — Implémentation »** couvrant, dans un seul checkpoint coordonné : migration additive `import_items`/`import_batches` + backfill, création des 5 RPC V2 (`import_batch_create_v2`, `import_item_set_user_choice_v1`, `import_canonical_claim_chunk_v1`, `import_canonical_commit_chunk_v1`, `seed_media_snapshot_for_batch_v2`), retrait des policies `INSERT`/`UPDATE` directes sur `import_items`, réécriture `src/lib/import.functions.ts` + `src/routes/_authenticated/import.tsx` pour appeler exclusivement les V2, tests PostgREST tampering + tests locks + bench 500 IDs réel. À exécuter sur une itération dédiée sans autre chantier concurrent, avec publication coordonnée en fin de phase.
