# KAZEN — Historique des phases et feuille de route

Chaque phase produit un rapport dans `.lovable/`. Verdicts : **PASS**, **PARTIAL**, **BLOCKED**.

---

## 1. Fondations (phases initiales)

- Bootstrap TanStack Start + Tailwind v4 + shadcn/ui, langage visuel « Aurora ».
- Internationalisation FR/EN de départ, dark-mode premium.
- Modèle `MediaItem` unifié anime / série / film, suivi de listes.
- Intégrations AniList et TMDB côté serveur ; résolution des 429 (file d'attente
  partagée + cache Postgres) et des 403 Cloudflare (repli navigateur).
- Catalogues paginés, fiches enrichies, retour en haut de page, restauration de scroll.

## 2. Social et communauté

- Playlists partagées et collaboratives, critiques et réponses.
- Forum par catégories, messagerie privée 1-à-1, salons de chat en direct.
- Notifications in-app, préférences, digest e-mail Resend.
- Assistant IA (Lovable AI Gateway) avec quotas, cache et réglages utilisateur.
- Import MAL/AniList/Nautiljon, export JSON/CSV.

## 3. Performance et stabilité

Passe globale : politiques de cache centralisées (`lib/queries.ts`), persistance des
filtres et du scroll par session (`lib/catalog-state.ts`), correction d'un mismatch
d'hydratation sur l'accueil (`NextEpisodePill` différé en `requestIdleCallback`),
vérification Playwright de la restauration de scroll et du scroll infini.

## 4. Phase 25 — Chat en direct et QA externe

- `.lovable/phase-25-2-live-chat-validation.md` — validation du chat en direct.
- `docs/phase-25-external-qa.md` — protocole de QA externe.

## 5. Phase 26 — Conformité légale et communautaire

| Rapport | Objet |
| --- | --- |
| `phase-26-1-critical-remediation.md` | correctifs critiques |
| `phase-26-2-legal-documents.md` | CGU, confidentialité, mentions légales |
| `phase-26-3-cookie-consent.md` | bannière et préférences de cookies |
| `phase-26-4-community-compliance.md` | audit sécurité + fonctionnel des espaces communautaires — verdict **PARTIAL**, 8 risques légaux identifiés |
| `phase-26-5-licenses-sources-attributions.md` | licences et attributions AniList/TMDB |
| `legal-audit.md` | audit légal transverse |

Remédiations notables : révocation d'`EXECUTE` sur `notify_member` / `forum_notify`
(anti-usurpation), élargissement de la contrainte `CHECK` sur
`member_notifications.notification_type` (7 types) qui provoquait des échecs silencieux.

## 6. Phase 27 — Internationalisation complète

`phase-27-i18n.md`, `-1-coverage`, `-2-profile`, `-3-catalog`, `-3b-fiches` — verdict **PASS**.
Couverture : authentification, profil et réglages, filtres de catalogue, fiches et suivi,
saisons, épisodes, états d'erreur.

## 7. Audit de contrôle 25.2 → 26.2

`audit-phases-25-2-to-26-2.md` — verdict **PARTIAL**.
- 62 fonctions `SECURITY DEFINER` exécutables par `anon` recensées et traitées.
- Durcissement de `seed_media_snapshot` (regex + limitation de débit).
- Correction d'une régression tronquant les imports AniList au-delà de 60 titres :
  création de `seed_media_snapshot_for_batch` (plafond 5 000, contrôle de propriété du lot).

## 8. Import Canonicalization V2

| Étape | Rapport | Verdict |
| --- | --- | --- |
| Benchmark V1 | `phase-import-canonicalization-v1-bench.md` | référence de performance |
| Conception V2 | `phase-import-canonicalization-v2-parallel.md` | chemin parallèle isolé, 8 RPC versionnées, drapeau serveur |
| Isolation de l'environnement | `phase-import-canonicalization-v2-staging-isolation.md` | **BLOCKED** — options A→E, recommandation : projet Supabase de staging séparé |
| H.1-PROD (audit lecture seule) | — | **PASS** — V2 absente de la production, garanties de sécurité confirmées |
| H.2-A (revue du diff) | — | **BLOCKED** — aucun canal de transfert exact disponible |
| H.2-EXPORT | — | **BLOCKED** — à exécuter depuis le projet de staging |
| H.2-B (intégration locale) | `phase-h.2-b-integration.md` | **PASS** |

### État de H.2-B (dernière phase terminée)

- Archive vérifiée par SHA-256, 33 fichiers intégrés.
- Runtime : `anilist-shared-queue.server.ts`, `import-canonical-v2.{server,functions}.ts`,
  `CanonicalV2Import.tsx`.
- Tests : 5 fichiers, **70/70 verts**.
- Route `/import` fusionnée manuellement : gate serveur `checkV2`, bascule conditionnelle
  V2 (AniList + flag actif) sinon V1, comportement *fail-closed*.
- Migrations **stagées, non appliquées** dans `.lovable/pending-phase-h2/migrations/`.
- Audit du bundle client : aucune fuite de secret ni d'identifiant de staging.
- `bunx tsgo --noEmit`, `bunx vitest run`, `bun run build` : tous verts.

---

## 9. Prochaine étape — Phase H.2-C

Revue humaine des SQL puis application ordonnée en production :

1. Comparer `compare-only/` à l'état réel (N1 revoke, correctif `CHECK`, trigger profil
   sont **déjà** en production — ne pas réappliquer).
2. Appliquer dans l'ordre `apply-candidates/01 → 06`, en vérifiant le project ref
   `yzmkeceduhzqqqpyfmdd` avant chaque écriture.
3. Activer le drapeau `IMPORT_CANONICALIZATION_V2` uniquement pour les `allowed_user_ids`
   de test, puis élargir progressivement.
4. Recette selon `docs/production-smoke-test.md`, puis publication.
5. Rollback disponible pour chaque candidat dans `rollbacks/`.

## 10. Travaux ouverts / idées

- Ajouter `wrangler` en devDependency si une prévisualisation Worker locale est souhaitée
  (optionnel, non nécessaire au build).
- Table `role_labels` pour rendre les libellés de rôle éditables par le fondateur
  (aujourd'hui constante dans `src/lib/roles.ts`).
- Poursuivre l'enrichissement des fiches (règle permanente : densité type Nautiljon,
  UX premium, sans perte de lisibilité ni de performance).
- Étendre la couverture de tests au-delà du domaine import.
