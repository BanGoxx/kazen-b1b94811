# KAZEN — Sécurité

## 1. Modèle général

- **Une seule source de vérité pour les autorisations : Postgres.** Chaque table de
  `public` a RLS activée et des policies explicites. Le client n'est jamais autorisé à
  décider d'un droit ; il ne fait que refléter ce que la base autorise.
- **Rôles hors profil.** Les rôles vivent dans `user_roles` et se lisent via
  `has_role(uuid, app_role)` en `SECURITY DEFINER`. Stocker un rôle sur `profiles`
  ouvrirait une escalade de privilèges triviale.
- **Secrets côté serveur uniquement.** Clés TMDB, Resend, `LOVABLE_API_KEY` et client
  admin ne sont lisibles que dans un handler de server function ou un `*.server.ts`.
  Aucun secret n'est exposé via `import.meta.env`.
- **Fail-closed.** Tout drapeau de fonctionnalité, tout gate d'accès et toute
  vérification de rôle échouent vers le refus, jamais vers l'autorisation.

## 2. Frontières applicatives

| Surface | Protection |
| --- | --- |
| Routes `_authenticated/*` | gate serveur dans `_authenticated/route.tsx`, redirection `/auth` |
| Server functions sensibles | `.middleware([requireSupabaseAuth])` → `context.supabase` en tant qu'utilisateur |
| Client admin (`client.server`) | importé dynamiquement **après** vérification du rôle, jamais pour une lecture ordinaire, jamais pour décider si l'appelant est admin |
| `*.server.ts` | bloqué par le bundler pour tout graphe client |
| `/api/chat.ts` | session vérifiée + quota IA réservé avant appel au modèle |

Une server function protégée ne doit jamais être appelée depuis le `loader` d'une route
publique : le prérendu n'a pas de session et renverrait `401` au build.

## 3. Durcissements déjà appliqués

| Sujet | Mesure |
| --- | --- |
| Usurpation de notification | `EXECUTE` sur `notify_member` et `forum_notify` révoqué de `PUBLIC`, `anon` et `authenticated` |
| Échecs silencieux de notification | contrainte `CHECK` sur `member_notifications.notification_type` élargie aux 7 types réellement émis |
| Fonctions `SECURITY DEFINER` exposées à `anon` | audit complet, révocations ciblées (62 fonctions passées en revue) |
| Falsification de métadonnées à l'import | `seed_media_snapshot` durcie : validation regex, limitation de débit ; `seed_media_snapshot_for_batch` ajoute la vérification de propriété du lot et le couplage `media_key` |
| Import volumineux | plafond explicite à 5 000 éléments par lot, avec contrainte SQL |
| Abus de formulaires | `beta_feedback_rate_limit`, `enforce_correction_request_rate_limit` |
| Fuite de secrets au bundle | audit du `dist/client/` : 0 occurrence de clé de service, de client admin ou d'identifiant de staging |
| Désinscription e-mail | jeton signé côté serveur (`unsub-token.server.ts`), pas d'identifiant en clair |

## 4. Garde anti-production

Toute opération d'écriture en base doit d'abord vérifier l'identité de l'environnement :

```text
SUPABASE_PROJECT_ID attendu (production) : yzmkeceduhzqqqpyfmdd
Projet de staging (jamais cible d'une écriture depuis ce workspace) : yuazpxegdqdeflbdyobd
```

Règles :
1. Lire `SUPABASE_PROJECT_ID` avant toute migration ou tout script d'écriture ; s'arrêter
   si la valeur ne correspond pas à l'environnement attendu par la phase en cours.
2. Aucune donnée utilisateur réelle ne quitte la production — le staging n'utilise que
   des comptes synthétiques.
3. Les migrations candidates restent dans `.lovable/pending-phase-h2/migrations/` tant
   qu'une revue humaine n'a pas eu lieu ; elles ne sont **pas** dans `supabase/migrations/`
   et ne peuvent donc pas s'appliquer par inadvertance.
4. Chaque candidat a un rollback correspondant, testé avant application.

## 5. Conformité (RGPD / DSA)

- Consentement cookies granulaire avant tout traceur non essentiel (`lib/consent.tsx`).
- Portabilité : export JSON/CSV complet des données personnelles.
- Droit à l'effacement : `account_deletion_requests` + parcours `/profil`.
- Vérification d'âge et règles communautaires publiées.
- Signalement de contenu accessible partout, actions de modération journalisées
  (`moderation_actions`) — traçabilité exigée par le DSA.
- Attribution des sources de données (AniList, TMDB) sur les pages légales.
- Contenu généré par IA explicitement étiqueté.

## 6. Checklist avant toute migration

- [ ] `GRANT` présent pour chaque nouvelle table publique
- [ ] RLS activée et au moins une policy par opération autorisée
- [ ] `anon` accordé **uniquement** si une policy le prévoit
- [ ] Fonctions `SECURITY DEFINER` : `SET search_path = public` + `REVOKE ... FROM PUBLIC, anon`
- [ ] Aucun rôle stocké hors `user_roles`
- [ ] Script de rollback écrit
- [ ] Environnement cible vérifié (§4)
