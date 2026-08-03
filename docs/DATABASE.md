# KAZEN — Base de données

Backend : Lovable Cloud (Supabase / Postgres). Project ref de production :
`yzmkeceduhzqqqpyfmdd`. **48 tables** dans le schéma `public`, toutes avec RLS activée,
**78 migrations** versionnées dans `supabase/migrations/`.

## 1. Principes non négociables

1. Toute table de `public` a `ENABLE ROW LEVEL SECURITY` **et** des `GRANT` explicites
   (`authenticated`, `service_role`, `anon` seulement si une policy autorise la lecture
   anonyme). RLS sans GRANT = table inaccessible ; GRANT sans policy = table verrouillée.
2. Ordre imposé dans une migration : `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY`.
3. Les rôles ne sont **jamais** stockés sur `profiles` — ils vivent dans `user_roles`,
   lus via la fonction `SECURITY DEFINER` `has_role(uuid, app_role)`.
4. Les fonctions `SECURITY DEFINER` sensibles sont `REVOKE`-ées de `PUBLIC`/`anon` et
   accordées uniquement à `authenticated` et/ou `service_role`.
5. Ne jamais toucher aux schémas `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.

## 2. Rôles et permissions

Enum `app_role`, du plus fort au plus faible :

| Rôle | Libellé public | Portée |
| --- | --- | --- |
| `owner` | Fondateur | compte fondateur unique, outils `/fondateur` |
| `admin` | Administrateur | gestion avancée de la plateforme |
| `moderator` | Modérateur | file de modération, masquage, sanctions |
| `editorial_contributor` | Contributeur éditorial | actualités, corrections de fiche |
| `trusted_member` | Membre de confiance | limites assouplies |
| `member` | Membre | droits par défaut |

Les libellés de `src/lib/roles.ts` sont **cosmétiques** ; seule la valeur de l'enum
détermine les droits. Helpers SQL : `has_role`, `is_moderator`, `can_moderate_now`,
`founder_user_ids`, `grant_role`.

## 3. Tables par domaine

### Identité et profil
| Table | Contenu |
| --- | --- |
| `profiles` | profil membre (pseudo, avatar, bio, confidentialité) — alimenté par le trigger `handle_new_user` |
| `user_roles` | attribution des rôles (`unique (user_id, role)`) |
| `public_badges`, `user_public_badges` | badges publics et leur attribution |
| `account_deletion_requests` | demandes de suppression de compte (RGPD) |
| `member_blocks` | blocages entre membres |

### Catalogue et enrichissement
| Table | Contenu |
| --- | --- |
| `media_records` | instantané canonique d'un média (`source` + `external_id`) |
| `media_enrichments` | données enrichies (crédits, vidéos, plateformes, scores) |
| `anilist_cache` | cache brut des réponses AniList (clé + payload + jeton) |
| `media_requests` | demandes d'ajout de titres manquants |
| `fiche_correction_requests` | signalements de correction de fiche |

### Suivi personnel
| Table | Contenu |
| --- | --- |
| `list_items` | cœur du suivi : statut, progression, note, rewatch, dates |
| `weekly_recap_reads` | accusés de lecture du récap hebdomadaire |
| `recommendation_feedback` | retours « pertinent / non pertinent » sur les reco |

### Playlists et critiques
| Table | Contenu |
| --- | --- |
| `playlists`, `playlist_items` | playlists et leur contenu ordonné |
| `playlist_collaborators`, `playlist_requests` | collaboration et demandes d'accès |
| `playlist_likes`, `shared_playlist_reviews` | likes et avis sur playlists partagées |
| `fiche_reviews`, `review_replies`, `review_likes`, `reply_likes` | critiques de fiches, réponses et likes |

### Communauté
| Table | Contenu |
| --- | --- |
| `forum_categories`, `forum_topics`, `forum_posts` | forum |
| `forum_reports`, `content_reports` | signalements |
| `moderation_actions` | journal d'audit des actions de modération |
| `chat_conversations`, `chat_participants`, `chat_messages` | messagerie privée 1-à-1 |
| `live_chat_rooms`, `live_chat_messages`, `live_chat_member_state` | salons en direct |

### Notifications et e-mails
| Table | Contenu |
| --- | --- |
| `member_notifications` | notifications in-app (contrainte `CHECK` sur `notification_type`) |
| `member_notification_preferences`, `member_email_preferences` | préférences |
| `email_delivery_logs` | journal d'envoi (Resend) |

### Assistant IA
| Table | Contenu |
| --- | --- |
| `ai_assistant_settings` | réglages par utilisateur |
| `ai_assistant_usage` | quotas et comptabilité de consommation |
| `ai_assistant_cache` | cache de réponses (verrou + TTL + versions) |
| `assistant_messages` | historique de conversation |

### Import / bêta
| Table | Contenu |
| --- | --- |
| `import_batches`, `import_items` | import V1 (lots et éléments) |
| `beta_feedback` | retours bêta (avec limitation de débit) |

## 4. Fonctions RPC notables

Toutes en `SECURITY DEFINER` avec `SET search_path = public`, sauf mention contraire.

**Rôles / accès** — `has_role`, `is_moderator`, `can_moderate_now`, `grant_role`,
`founder_user_ids`, `is_chat_participant`, `can_view_playlist`,
`is_playlist_collaborator`, `is_playlist_editor`.

**Forum** — `create_forum_topic`, `create_forum_post`, `edit_forum_topic`,
`edit_forum_post`, `delete_forum_topic`, `delete_forum_post`,
`moderate_clear_forum_cover`, `forum_notify` (révoquée de `PUBLIC`/`anon`/`authenticated`).

**Chat** — `accept_conversation`, `decline_conversation`, `archive_conversation`,
`mark_conversation_read`, `block_chat_member`, `edit_chat_message`,
`delete_chat_message`, `edit_live_chat_message`, `delete_live_chat_message`,
`hide_live_chat_message`, `mark_live_chat_read`, `live_chat_admin_stats`, `chat_pair_key`.

**Modération** — `moderate_content(target_type, target_id, action, reason, note, report_id)`,
`create_system_notice`, `notify_member` (révoquée de `PUBLIC`/`anon`/`authenticated`).

**Communauté / stats publiques** — `get_community_contributors`,
`get_community_trending_titles`, `get_community_genre_trends`,
`get_community_popular_playlists`, `get_community_helpful_reviews`.

**Profil** — `get_my_profile`, `get_public_profile`, `get_public_favorites`,
`get_public_enrichment`, `handle_new_user` (trigger sur `auth.users`, compatible OAuth).

**Assistant IA** — `ai_assistant_reserve`, `ai_assistant_finalize`, `ai_assistant_my_quota`,
`ai_assistant_update_settings`, `ai_assistant_admin_stats`,
`ai_assistant_cache_{try,poll,store,release,reserve}`.

**Cache AniList** — `anilist_cache_get`, `anilist_cache_put`.

**Import V1** — `seed_media_snapshot(...)` et `seed_media_snapshot_for_batch(...)`
(validation par regex, limitation de débit, contrôle de propriété du lot, plafond
5 000 éléments, vérification du couplage `media_key`).

**Limitations de débit** — `beta_feedback_rate_limit`,
`enforce_correction_request_rate_limit`.

## 5. Migrations

- Répertoire actif : `supabase/migrations/` (78 fichiers, horodatés).
- Répertoire **en attente de revue humaine** : `.lovable/pending-phase-h2/migrations/`
  — ces fichiers ne sont **pas** appliqués automatiquement :
  - `apply-candidates/01…06` : fondation Import Canonicalization V2, correctif de contrainte
    `total_count`, allowlist du feature flag, versions successives du worker ;
  - `compare-only/` : objets déjà présents en production (à comparer, pas à réappliquer) ;
  - `rollbacks/` : script de retour arrière pour chaque candidat.

Avant d'appliquer un candidat : vérifier qu'il n'est pas déjà en production (`compare-only`),
appliquer dans l'ordre numérique, valider le rollback correspondant.

## 6. Import Canonicalization V2 (non déployé)

Objectif : empêcher la falsification de métadonnées lors d'un import en récupérant les
données canoniques **côté serveur**, par tronçons, avec verrous.

- Tables prévues : `import_canonical_v2_batches`, `import_canonical_v2_items`,
  `app_feature_flags` (avec `allowed_user_ids` pour une ouverture progressive).
- RPC prévues : `create_batch`, `preview`, `claim_chunk`, `store_chunk`, `release_lock`,
  `progress`, `confirm`, `rollback`, `skip_failed`, `is_enabled`.
- Le code applicatif est **déjà intégré** (`src/lib/import-canonical-v2.*`,
  `src/components/import/CanonicalV2Import.tsx`) et **fail-closed** : sans le flag DB,
  `is_enabled()` renvoie `false` et `/import` reste sur le chemin V1.
- Statut : en attente de la phase H.2-C (revue humaine des SQL puis application ordonnée).
