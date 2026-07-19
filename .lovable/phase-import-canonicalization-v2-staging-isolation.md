# KAZEN — Phase Import Canonicalization V2 : Audit d'isolation staging

## Verdict

**BLOCKED** — Aucun environnement isolé n'existe actuellement. La création d'un
environnement conforme aux critères d'isolation nécessite une décision humaine
explicite (choix entre Postgres local éphémère via Nix, projet Supabase staging
séparé, ou fork Lovable). Aucune modification n'a été appliquée.

## Environnement actuel

- **Projet Lovable** : KAZEN (ID interne d81bc3c1-…), une seule base partagée.
- **Backend** : Lovable Cloud (Supabase managé), project ref `yzmkeceduhzqqqpyfmdd`
  (déclaré dans `supabase/config.toml`, seul projet configuré).
- **URL Supabase / clés** : injectées dans `.env` (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) — valeurs non
  révélées ici. Aucune variable `_STAGING`, `_DEV_DB`, `_PREVIEW_DB` détectée.
- **Preview vs Production** : partagent la même base (`yzmkeceduhzqqqpyfmdd`).
  Preview = `id-preview--…lovable.app`, Publié = `kazen.lovable.app`. Aucun
  cloisonnement DB entre les deux.
- **Sandbox Lovable** : `psql` disponible, `PGHOST` et `SUPABASE_DB_URL`
  pointent vers la base Production partagée — donc tout `psql` mutant frappe la
  Production. Pas de Supabase CLI, pas de Docker, pas de Podman, pas de binaire
  `postgres` local ; `nix` disponible (permet d'installer un Postgres éphémère
  sur demande).
- **Supabase Branching** : non détecté (aucune référence de branche dans
  `config.toml` ni dans les variables d'env). Fonctionnalité payante côté
  Supabase — nécessite autorisation.
- **Fork Lovable** : possible manuellement depuis l'UI, mais crée une nouvelle
  base Cloud (facturable au-delà des quotas gratuits) — nécessite autorisation.

## Options d'isolation A–E

| Option | Disponible | Isol. DB | Isol. Auth | Isol. Storage | Coût potentiel | Données prod nécessaires | Compat. migrations | Limites | Action requise |
|---|---|---|---|---|---|---|---|---|---|
| **A. Postgres local éphémère (Nix)** | Oui via `nix run nixpkgs#postgresql` | ✅ URL/port locaux | ⚠️ pas de GoTrue — auth simulée | ✅ désactivé | 0 € | Non | ⚠️ dépendances Supabase (`auth`, `storage`, `pg_net`, `pgjwt`, `pg_cron`) absentes | Pas de Realtime, pas de RLS via JWT réel, éphémère (perdu au redémarrage sandbox) | Autorisation humaine + décision sur mocks des extensions Supabase |
| **B. Branche Supabase isolée** | Non détectée | ✅ | ✅ | ✅ | Payant (add-on Branching) | Non | ✅ 100 % | Nécessite plan Supabase compatible | Autorisation humaine + activation côté Supabase (hors Lovable) |
| **C. Projet Supabase staging séparé** | Non existant | ✅ | ✅ | ✅ | Gratuit jusqu'aux quotas free-tier, sinon payant | Non | ✅ 100 % | Création manuelle, gestion des secrets à part | Autorisation humaine + création du projet |
| **D. Fork Lovable dédié staging** | Possible via UI Lovable | ✅ (nouveau Cloud) | ✅ | ✅ | Selon quotas workspace | Non | ✅ 100 % | Duplication du code à maintenir, publication séparée à désactiver | Autorisation humaine + fork via UI |
| **E. Autre (Docker/supabase start)** | Non — Docker absent du sandbox | — | — | — | 0 € en local dev | Non | ✅ si Supabase CLI installé | Impossible dans ce harnais | Environnement de dev externe côté utilisateur |

## Option recommandée

**Option C — Projet Supabase staging séparé**, créé via un second projet Lovable
Cloud (nouveau workspace/projet dédié « KAZEN-staging »). Raisons :

- Reproduit fidèlement l'environnement Production (mêmes extensions, GoTrue,
  Storage, Realtime, RLS via JWT réel).
- Reconstruction complète depuis `supabase/migrations` sans dépendance runtime
  manquante.
- Isolation totale par construction (ref/URL/clés/Auth/Storage distincts).
- Reste dans le free-tier Supabase pour des volumes de test (100/500/5 000
  fixtures synthétiques).

Fallback low-cost : **Option A** (Postgres Nix éphémère) uniquement pour un
smoke schéma-only, en acceptant que les migrations dépendantes de `auth.uid()`,
`pg_net`, `pg_cron`, `storage.*` ne rejoueront pas telles quelles.

## Isolation DB / Auth / Storage / Realtime

Aujourd'hui : **aucune**. Preview et Production partagent tout. Toute écriture
`psql` depuis le sandbox impacte la Production. Le critère « isolation »
(URL/ref/clés/Auth/Realtime/Storage distincts) n'est satisfait par aucun
environnement existant.

## Coût potentiel

- Option A : 0 €.
- Option B : add-on Branching Supabase (payant, non autorisé).
- Option C : free-tier Supabase probable ; débordement facturable — à valider.
- Option D : dépend du workspace Lovable (quotas Cloud).

**Aucun service payant n'a été créé.**

## Actions appliquées

Aucune. Cette phase est exclusivement un audit. Aucune migration, aucun code,
aucun secret, aucune donnée n'ont été modifiés.

## Actions nécessitant une autorisation humaine

1. Choix de l'option (A/C/D recommandées).
2. Si C : création manuelle d'un second projet Lovable Cloud « KAZEN-staging »
   et fourniture de ses secrets (URL, publishable, service_role) sous un jeu de
   variables séparé (`STAGING_SUPABASE_*`), stockées via `add_secret`.
3. Si A : autorisation d'installer Postgres via `nix run nixpkgs#postgresql`
   dans le sandbox et d'y rejouer un sous-ensemble compatible des migrations.
4. Confirmation que la Preview publiée continuera à pointer sur la base
   partagée actuelle (aucun basculement).

## Reconstruction par migrations

- Source unique de vérité : `supabase/migrations/` (78 fichiers).
- Types : `src/integrations/supabase/types.ts` régénéré après migration en
  staging uniquement.
- Séquence attendue en environnement isolé : création DB → extensions requises
  (`pgcrypto`, `pg_net`, `pg_cron`, `pgjwt`) → application séquentielle des 78
  migrations → vérification tables/RPC/RLS/triggers → génération des types →
  smoke test.

## Migrations problématiques (à documenter, pas à corriger sur prod)

- Migrations invoquant `pg_net`/`http` (webhooks, appels sortants) : à
  neutraliser en staging via variables ou mocks.
- Migrations dépendantes de `auth.users` seed : nécessitent création préalable
  de comptes GoTrue de test.
- Migrations touchant `storage.*` : Storage à désactiver ou provisionner à
  vide en staging.
- Migrations liées à `pg_cron` : jobs à laisser désactivés en staging pour
  éviter tout appel externe.

Aucune correction ne sera appliquée en Production pendant cette phase.

## Fixtures

À créer **uniquement** en environnement isolé, à partir de :

- IDs AniList/TMDB publics choisis (10 titres seed minimaux) ;
- batches synthétiques de 100 / 500 / 5 000 items générés par script ;
- forum/chat/notifications fictifs si nécessaires pour tests de coexistence.

Interdictions respectées : aucune copie de `auth.users`, aucun email réel,
aucun message privé, aucune liste privée, aucun token, aucun log sensible,
aucune donnée de paiement, aucun secret IA.

## Comptes de test

À créer en staging uniquement :

- `membre_test_a@kazen.invalid`
- `membre_test_b@kazen.invalid`
- `moderator_test@kazen.invalid`
- `owner_test@kazen.invalid` (seulement si test d'escalade requis)

Emails `.invalid` (RFC 2606) — aucune délivrabilité possible, aucun risque
d'envoi réel.

## Providers

- **AniList / TMDB** : endpoints publics, rate limits respectés. Volumes élevés
  (500/5 000) via fixtures JSON préconstruites ; quelques vrais appels réseau
  conservés pour bench réaliste (≤ 100 IDs).
- **Resend / email** : adaptateur no-op forcé en staging (kill switch
  `EMAILS_ENABLED=false`).
- **IA (Lovable AI Gateway)** : désactivée par défaut en staging
  (`AI_ASSISTANT_ENABLED=false`) — aucun quota consommé pendant les tests
  d'import.

## Emails

Désactivés en staging via kill switch. Aucun envoi réel possible avec les
adresses `.invalid`.

## IA

Désactivée par défaut en staging. Kill switch respecté. Aucun appel payant.

## Feature flag

`IMPORT_CANONICALIZATION_V2` :

- Staging : `ON` (décidé côté serveur, lu depuis env staging uniquement).
- Preview / Production : `OFF` (absence de variable = OFF).

Garanties de conception :

- Le flag est lu **côté serveur** dans un `createServerFn`, jamais depuis le
  client ; ni URL param, ni `localStorage`, ni cookie ne peuvent le forcer.
- La valeur staging est stockée dans le jeu de secrets du projet staging
  isolé — inaccessible depuis Production.
- L'absence de variable côté serveur retourne `false` par défaut.

## Garde anti-Production

Design (à implémenter dans la phase d'exécution, pas maintenant) :

Avant tout test mutationnel, vérification stricte de :

1. `SUPABASE_PROJECT_ID === STAGING_EXPECTED_REF` (comparaison littérale, pas
   sur le nom d'environnement).
2. `SUPABASE_URL` matche l'URL staging attendue.
3. `KAZEN_STAGING === "true"`.
4. Absence de domaines Production (`kazen.lovable.app`, custom domains).
5. Absence de `SUPABASE_SERVICE_ROLE_KEY` de Production (empreinte hash
   comparée à une valeur autorisée uniquement en staging).

Si une seule vérification échoue → arrêt immédiat, aucune migration, aucune
donnée créée, verdict `BLOCKED`.

**Garde à comparer sur un identifiant explicite de projet**, jamais sur un nom
symbolique (« staging », « dev ») pouvant être usurpé.

## Smoke tests d'isolation (1–10)

À exécuter **après** création de l'environnement isolé. Aujourd'hui non
exécutables (pas d'environnement isolé).

1. Écriture staging invisible en Production — À exécuter.
2. Utilisateur staging absent de Production — À exécuter.
3. Migration staging absente de Production — À exécuter.
4. Realtime staging séparé — À exécuter.
5. Storage séparé/désactivé — À exécuter.
6. Emails désactivés — À exécuter.
7. IA désactivée — À exécuter.
8. Rollback staging sans effet Production — À exécuter.
9. Suppression fixture sans effet Production — À exécuter.
10. Site publié toujours fonctionnel (`kazen.lovable.app`) — actuellement vrai,
    à re-vérifier à chaque étape ultérieure.

## Fichiers modifiés

- `.lovable/phase-import-canonicalization-v2-staging-isolation.md` (créé, ce
  document — le seul fichier écrit).

Aucun autre fichier n'a été modifié. Aucune migration. Aucune RLS. Aucune RPC.
Aucun composant. Aucune route. Aucun secret.

## Production

Aucun impact. Base partagée intacte. Frontend publié intact. DA intacte. RLS
intactes. RPC intactes. Aucun webhook ni email déclenché.

## Base partagée

Aucun `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `GRANT`, `REVOKE`, `CREATE` ni
`DROP` n'a été exécuté. Aucune lecture mutante.

## Vérification de la DA

Non impactée — aucun fichier UI touché, aucune classe Tailwind modifiée, aucun
token OKLCH altéré.

## Rollback

Rien à rollback (aucune modification appliquée). Suppression triviale du
document `.lovable/phase-import-canonicalization-v2-staging-isolation.md` si
requis.

## Limitations

- Impossible de créer automatiquement un projet Supabase staging depuis ce
  harnais sans autorisation humaine.
- Impossible d'activer Supabase Branching depuis Lovable (feature côté
  Supabase, payante).
- Postgres local via Nix ne reproduit pas GoTrue/Storage/Realtime — utilisable
  seulement pour un smoke schéma-only.
- Le sandbox est éphémère : toute base locale doit être re-provisionnée à
  chaque session.

## Publication : NON EFFECTUÉE

## Checkpoint publiable : NON

## Prochain prompt recommandé

> **KAZEN — Décision d'environnement staging pour Import Canonicalization V2**
>
> Choisir explicitement entre :
> - (C) créer un second projet Lovable Cloud « KAZEN-staging » (recommandé) ;
> - (A) provisionner un Postgres éphémère via `nix run nixpkgs#postgresql` (smoke
>   schéma-only, limité) ;
> - (D) forker le projet Lovable actuel vers un espace de staging dédié.
>
> Après décision, fournir les secrets staging via `add_secret`
> (`STAGING_SUPABASE_URL`, `STAGING_SUPABASE_PUBLISHABLE_KEY`,
> `STAGING_SUPABASE_SERVICE_ROLE_KEY`, `STAGING_PROJECT_REF`,
> `KAZEN_STAGING=true`) et lancer la phase suivante :
>
> **Import Canonicalization V2 — Implémentation en staging**, qui reprend le
> design gelé dans `.lovable/phase-import-canonicalization-v1-bench.md` et
> `.lovable/phase-import-canonicalization-v2-parallel.md`, interdit toute
> application sur la base partagée, et n'exécute les migrations, RPC, RLS et
> fixtures que derrière la garde anti-Production décrite ci-dessus.
