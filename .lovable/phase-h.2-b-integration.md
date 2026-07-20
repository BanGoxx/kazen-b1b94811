# KAZEN — Phase H.2-B — Intégration locale du code candidat

## A. Garde d'identité
- `SUPABASE_PROJECT_ID` = `yzmkeceduhzqqqpyfmdd` (VRAI KAZEN).
- Aucune migration exécutée. Aucune requête d'écriture DB émise.

## B. Vérification de l'archive
- Fichier : `/mnt/user-uploads/kazen-phase-h-transfer.tar.gz`.
- SHA-256 mesuré : `1d81482f935547041981261f0ba948e008668979b462205a487f86d1737ca247`.
- SHA-256 attendu : identique — **MATCH**.
- Manifest confirme origin `yuazpxegdqdeflbdyobd` / target `yzmkeceduhzqqqpyfmdd`.

## C. Fichiers appliqués (33 items)
### Runtime (COPY_NEW)
- `src/lib/anilist-shared-queue.server.ts`
- `src/lib/import-canonical-v2.server.ts`
- `src/lib/import-canonical-v2.functions.ts`
- `src/components/import/CanonicalV2Import.tsx`

### Tests (placés à côté des sources pour imports relatifs `./...`)
- `src/lib/import-canonical-v2.test.ts` (39 tests)
- `src/lib/import-canonical-v2.orchestrator.test.ts` (11)
- `src/lib/import-canonical-v2-metrics.test.ts` (6)
- `src/lib/import-canonical-v2.gate.test.ts` (8)
- `src/components/import/CanonicalV2Import.retry-ux.test.ts` (6)

### Route (MANUAL_MERGE)
- `src/routes/_authenticated/import.tsx` — hunks du patch appliqués :
  - imports `isCanonicalImportV2Enabled` + `CanonicalV2Import`
  - state `v2Enabled` + serverFn `checkV2` + effet fail-closed
  - swap conditionnel `canonical-v2-panel` (AniList + gate ON) sinon `legacy-v1-upload`
  - marqueurs `data-testid` conservés

### Migrations (STAGED — non exécutées)
Placées dans `.lovable/pending-phase-h2/migrations/` (pas sous `supabase/migrations/`) :
- `apply-candidates/` : 6 fichiers (`01_v2_foundation` … `06_worker_final_qualified`)
- `compare-only/` : `N1_notify_forum_revoke.sql`, `PROFILE_trigger_handle_new_user.sql`
- `rollbacks/` : 6 rollbacks

## D. Adaptations minimales
1. `src/lib/import-canonical-v2.server.ts` — `UserClient` typé `SupabaseClient` (untyped) au lieu de `SupabaseClient<Database>` : les tables `import_canonical_v2_*` et RPCs `import_canonical_v2_*` ne sont pas encore dans `types.ts` (leur migration DB est différée à H.2-C). Le typecheck reste vert ; la validation runtime est effectuée par les RPCs DB. Aucune surface de sécurité modifiée.
2. Tests déplacés à côté des sources (imports relatifs `./import-canonical-v2.functions`), sans altération du code de test.
3. `vitest` ajouté en `devDependencies` (test framework absent de production ; nécessaire pour la vérification de la phase). Aucune dépendance runtime ajoutée.

## E. Sécurité — audit bundle
- `dist/client/` : **0** occurrence de `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_…`, `buildAuthContext`, `withAniListSlot`, `import-canonical-v2.server`.
- Aucune fuite du project ref staging `yuazpxegdqdeflbdyobd`.
- Panneau `Import canonique V2` présent dans le chunk client `assets/import-BzcFBNZi.js` (attendu — UI cliente) et SSR `_ssr/import-BXZuXC-p.mjs`.

## F. Vérifications
- `bunx tsgo --noEmit` : **PASS** (0 erreur).
- `bunx vitest run` : **70 / 70 tests PASS** en 1.22 s.
- `bun run build` : **PASS**.

## G. Comportement gate (fail-closed)
- `checkV2()` échoue → `setV2Enabled(false)` → l'UI reste sur `legacy-v1-upload`. Confirmé par tests `gate.test.ts` (8 scénarios).
- Aucune décision côté client (pas de query/localStorage/cookie).
- Gate DB non provisionné en production (V2 tables absentes) → gate retourne `enabled=false` naturellement.

## H. Verdict — **PASS**
Code candidat intégré, typé, testé, buildé. Aucun accès DB production. `wrangler` non ajouté (optionnel dev, non nécessaire au build).

---

ENVIRONNEMENT : VRAI KAZEN (`yzmkeceduhzqqqpyfmdd`)
CODE LOCAL MODIFIÉ : OUI (11 fichiers + `package.json` devDep vitest)
BASE PRODUCTION MODIFIÉE : NON
MIGRATIONS APPLIQUÉES : NON (staged dans `.lovable/pending-phase-h2/migrations/`)
DÉPLOIEMENT : NON
FLAG V2 CÔTÉ DB : ABSENT (gate fail-closed retourne false)
ÉTAPE SUIVANTE : H.2-C — revue humaine des SQL puis application ordonnée en production.
