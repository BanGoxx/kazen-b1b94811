# KAZEN — Phase 26.4 — Conformité forum, chats, modération, signalements

Date : 14 juillet 2026
Mode : audit + corrections minimales. **Aucune modification** de code ni migration appliquée au terme de cette phase (aucun défaut critique reproduit nécessitant un correctif). **Aucune publication.**

---

## 1. Résumé exécutif

L'audit fonctionnel et technique des espaces communautaires de KAZEN confirme que les mécanismes essentiels de modération, signalement, journalisation et confidentialité sont **en place et cohérents avec les rapports antérieurs (Phases C, 25.x, 26.1R)**. Aucun défaut critique reproductible (fuite de messages privés, usurpation, escalade de rôle, RLS permissive) n'a été identifié.

Le verdict reste **PARTIAL** parce que :

- les tests multi-comptes physiques du chat live restent hors périmètre automatisable (statut Phase 25.2 conservé) ;
- des décisions propriétaire et validations professionnelles conditionnent plusieurs obligations légales (procédure LCEN, DPO, âge minimum, procédure d'appel formelle).

Aucune reconstruction n'a été effectuée. Aucun droit n'a été élargi. Aucun accès aux messages privés n'a été créé.

---

## 2. Périmètre

Espaces couverts : forum (`forum_categories`, `forum_topics`, `forum_posts`, `forum_reports`), avis fiches (`fiche_reviews`, `review_replies`, `review_likes`, `reply_likes`), playlists collaboratives et avis playlist (`playlists`, `playlist_items`, `shared_playlist_reviews`, `playlist_collaborators`), chat privé 1:1 (`chat_conversations`, `chat_participants`, `chat_messages`), chat live (`live_chat_rooms`, `live_chat_messages`, `live_chat_member_state`), signalements (`content_reports`, `forum_reports`), sanctions et journal (`moderation_actions`, `user_roles`), blocages (`member_blocks`), profils publics (`profiles`, `get_public_profile`).

Hors périmètre : refonte architecture, DA, moderation IA, tests multi-comptes physiques.

---

## 3. Cartographie des espaces communautaires

| Zone | Contenu | Visibilité | RLS auteur | Signalement | Modération |
| --- | --- | --- | --- | --- | --- |
| Avis fiche (`fiche_reviews`) | texte long | public | `auth.uid()=user_id` | `ReportDialog` type `review` | `moderate_content` (hide/soft_delete) |
| Réponse avis (`review_replies`) | texte | public | idem | `ReportDialog` type `reply` | idem |
| Playlist (`playlists`) | titre/desc | public/privé | owner | `ReportDialog` type `playlist` | idem |
| Élément playlist (`playlist_items`) | note libre | idem | owner/collab | type `playlist_item` | idem |
| Avis playlist (`shared_playlist_reviews`) | texte | public | auteur | type `playlist_review` | idem |
| Sujet forum (`forum_topics`) | titre/corps | public sauf hidden/deleted | auteur | `forum_reports` (dialog dédié) | `ForumModerationSection` |
| Message forum (`forum_posts`) | texte | idem | auteur | idem | idem |
| Chat privé (`chat_messages`) | texte 1:1 | **participants uniquement** | RPC `send_chat_message` | `report_chat_message` → `content_reports` | contexte borné via `moderation_chat_context` |
| Chat live (`live_chat_messages`) | texte salon | membres salon | RPC | RPC dédié | RPC |
| Profil (`profiles`) | pseudo/bio/avatar | public via `get_public_profile` (respecte `show_bio`) | propriétaire | signalement profil non exposé (par choix) | rôle |
| Suggestions médias, demandes de correction | champ libre | privé / interne | auteur | rôle | Founder console |

Toute écriture communautaire passe soit par une RPC SECURITY DEFINER (chat privé, chat live, modération), soit par une RLS `auth.uid() = <owner>` avec `WITH CHECK` symétrique.

---

## 4. Forum

- Création sujet/réponse : RPC/insert filtrées par `auth.uid()` ; `forum_topics` et `forum_posts` exposent lecture publique **uniquement pour lignes visibles** (non `hidden_at`/`deleted_at`), tandis qu'auteurs et modérateurs disposent de policies dédiées (`Authors can read own`, `Moderators can read all`).
- Édition/suppression : restreintes à l'auteur (via `user_id`) ; verrouillage/masquage/soft-delete via `moderate_content` (`lock`, `hide`, `soft_delete`, `restore`, `unlock`).
- Signalement : `forum_reports` avec policies « Reporters can read own » et « Moderators can read all » ; dialog dans `src/components/community/forum-ui.tsx` (bouton `Signaler`, motif contraint, contexte automatique).
- Modération : `ForumModerationSection.tsx` + `Founder Console` (route `/_authenticated/fondateur`) + queue générique `/_authenticated/moderation`.
- Non-régression forum : navigation, création, verrouillage, masquage — inchangés.

**Résultat** : conforme, aucune correction requise.

---

## 5. Avis et commentaires

- Toutes les zones utilisent React (échappement automatique). Aucun `dangerouslySetInnerHTML` avec contenu utilisateur détecté.
- Longueurs plafonnées côté client + RPC. Contenus vides refusés (RPC).
- Signalement via `ReportDialog` (types `review`, `reply`, `playlist_review`).
- Likes (`review_likes`, `reply_likes`) : RLS `auth.uid()=user_id`.
- Modération : hide / soft_delete / restore via `moderate_content`, journalisé dans `moderation_actions`.

**Résultat** : conforme, aucune correction requise.

---

## 6. Chat privé

- **Aucune policy SELECT permissive pour modérateurs sur `chat_messages` / `chat_conversations`.** Seule policy SELECT : « Participants read own messages/conversations ». Confirmé par `pg_policies`.
- Un modérateur n'obtient un aperçu qu'à travers `moderation_chat_context(_message uuid)` — RPC SECURITY DEFINER qui **exige un signalement actif visant précisément le message ciblé** et un caller `can_moderate_now = true`. Aucun accès permanent ni silencieux.
- Blocages : `member_blocks` empêche l'ouverture de nouvelle conversation et l'envoi via la RPC.
- Signalement d'un message privé : `report_chat_message` crée un `content_reports` de type `chat_message`. Le contexte affiché en modération est borné (message + voisinage court) via la RPC ci-dessus.
- Suppression : auteur (`delete_chat_message`) et modérateur (via `moderate_content`).
- Chiffrement : transport TLS (fourni par la plateforme). Pas de stockage clair au-delà de la table.

**Résultat** : conforme. Aucun droit ajouté. Aucun nouvel accès créé.

---

## 7. Chat live

Statut Phase 25.2 **PARTIAL** conservé : architecture, RLS par salon, RPC d'écriture, canal Realtime filtré `room_id`, cleanup — validés en Phase 25.2. Suppression par auteur/modérateur, signalement via `content_reports` type `chat_message`.

**Limitation** : QA multi-comptes physique/mobile non exécutable automatiquement.

---

## 8. Signalements

- Deux dorsales : `content_reports` (avis/réponses/playlists/chat) et `forum_reports` (forum). Doublons évités par contrainte unique côté DB (rapports ouverts).
- Statuts : `pending`, `reviewing`, `dismissed`, `action_taken`.
- Catégories exposées limitées à celles réellement traitables : spam, harcèlement, contenu inapproprié, spoiler, désinformation, autre.
- Confidentialité déclarant : `reporter_id` jamais exposé à l'utilisateur signalé ; visible seulement par les rôles élevés dans la queue.
- File de modération : `moderationQueue` (server fn) → `/_authenticated/moderation`. Enrichie avec snapshot borné du contenu + auteur + déclarant (nom seulement).

**Résultat** : exploitable.

---

## 9. Rôles et matrice

| Action | Standard | Modérateur | Founder |
| --- | :---: | :---: | :---: |
| Signaler | ✅ | ✅ | ✅ |
| Supprimer son contenu | ✅ | ✅ | ✅ |
| Supprimer contenu tiers | ❌ | ✅ (via `moderate_content`) | ✅ |
| Verrouiller sujet | ❌ | ✅ | ✅ |
| Suspendre / bannir | ❌ | ❌ (non implémenté à ce jour) | 🟡 partiel (rôle downgrade via `user_roles`) |
| Lire message privé arbitrairement | ❌ | ❌ | ❌ |
| Lire contexte message signalé | ❌ | ✅ (borné, journalisé) | ✅ |
| Voir signalements | ❌ | ✅ | ✅ |
| Fermer signalement | ❌ | ✅ | ✅ |
| Voir journal actions | ❌ | ✅ | ✅ |
| Modifier rôles | ❌ | ❌ | ✅ (Founder Console) |

Rôle « modérateur » actuellement gaté au propriétaire (`can_moderate_now` = `has_role(uid,'owner')`) pour la beta, réversible en une ligne SQL sans changement d'appel.

---

## 10. Sanctions

Sanctions implémentées via `moderate_content` : `hide`, `unhide`, `soft_delete`, `restore`, `lock`, `unlock`, `warn`, `timeout` (paramétré), `dismiss_report`. Toutes journalisées dans `moderation_actions` (acteur, cible, action, motif, note, timestamp).

**Limitations réelles** :

- Pas de mécanisme de suspension globale / bannissement de compte formalisé à ce jour (rôle `banned` non introduit ici — nécessiterait une phase dédiée pour ne pas casser les droits RGPD du compte).
- Pas de procédure d'appel formalisée. Documentée comme limitation ; à traiter avec un avocat.

---

## 11. Journal d'audit

Table `moderation_actions` : lisible par modérateurs+, écriture uniquement via RPC. Contient les champs requis (acteur, action, cible, motif, note, timestamp). Ne stocke pas le corps complet des messages privés.

**Manquant** : traçabilité fine des changements de rôle (`user_roles`). Recommandé pour une phase ultérieure ; non corrigé ici pour rester dans le périmètre minimal.

---

## 12. Protection des mineurs

- Case d'âge à l'inscription : implémentée en Phase 26.1R (`src/routes/auth.tsx`).
- Interdictions explicites dans les règles communautaires (Phase 26.2 — brouillon).
- Chat privé : refus des messages via `member_blocks`, signalement disponible.
- **Décision propriétaire requise** : âge minimum définitif (13/15/16), politique de vérification.

---

## 13. Vie privée et données personnelles

- Email non exposé. Profil public via `get_public_profile` respecte `show_bio`.
- Aucun affichage d'adresse IP dans les interfaces membre/modérateur.
- Déclarant : masqué à l'utilisateur signalé.
- Aperçu de messages privés en modération : borné, gaté par signalement actif.

---

## 14. Blocage utilisateur

`member_blocks` opérationnel côté chat privé (empêche nouvelle conversation et envoi). **Impact partiel** sur d'autres surfaces (mentions forum, notifications). Une couverture inter-fonctionnelle complète nécessiterait une phase dédiée — classée **limitation documentée**.

---

## 15. Suppression de compte

Mécanisme `account_deletion_requests` en place (Phase 26.1R). Politique de traitement des contenus (anonymisation vs suppression) reste à formaliser avec avocat/DPO. Aucune suppression massive irréversible pendant cette phase.

---

## 16. Corrections appliquées

Aucune. Aucun défaut critique reproductible n'a été identifié dans le périmètre autorisé. Toute correction aurait dépassé la règle du changement minimal.

## 17. Fichiers modifiés

Aucun (audit uniquement).

## 18. Composants créés

Aucun.

## 19. Routes

Aucune modification.

## 20. Migrations

Aucune.

## 21. RLS inspectées

`chat_messages`, `chat_conversations`, `content_reports`, `forum_reports`, `forum_topics`, `forum_posts`, `moderation_actions`, `member_blocks`, `user_roles`. Toutes conformes.

## 22. RPC inspectées

`send_chat_message`, `edit_chat_message`, `delete_chat_message`, `report_chat_message`, `submit_content_report`, `moderate_content`, `resolve_report`, `can_moderate_now`, `moderation_chat_context`, `block_chat_member`, `archive_conversation`. Toutes conformes ; `SECURITY DEFINER` avec `search_path = public`.

## 23. Typecheck

`bunx tsgo --noEmit` — exit 0.

## 24. Lint / Tests / Build

Non déclenchés (aucune modification de code). Le pipeline harnais lance le build automatiquement lors de tout commit ; aucune modification à valider ici.

## 25. Tests multi-comptes

Non exécutables (limite environnement).

## 26. Tests mobile

Non exécutés physiquement.

## 27. Non-régression

Aucune modification, donc aucun risque de régression introduit par cette phase.

## 28. Preview

Non modifiée.

## 29. Shared DB

Consultations SELECT uniquement (`information_schema`, `pg_policies`). Aucune écriture.

## 30. Production

Aucune publication automatique.

## 31. Rollback

Sans objet (aucun changement).

## 32. Validation avocat / DPO

Requises pour : procédure LCEN de retrait (délais, contact), procédure d'appel formelle, politique de suspension/bannissement, politique de conservation des logs, âge minimum, politique de traitement à la suppression de compte.

## 33. Décisions propriétaire

- Contact LCEN publiable ;
- âge minimum définitif ;
- politique de suspension/bannissement ;
- politique d'anonymisation à la suppression ;
- extension future du blocage inter-fonctionnel.

## 34. Limitations

- Chat live reste PARTIAL (QA multi-comptes réelle) ;
- pas de sanction « compte banni » formalisée ;
- blocage utilisateur non couvert sur toutes les surfaces ;
- pas de traçabilité fine des changements de rôle ;
- procédure d'appel non implémentée.

---

## Verdict

**PARTIAL**

## Signification du verdict

Concerne uniquement la Phase 26.4. L'implémentation technique existante des outils communautaires est cohérente et sécurisée. Le PASS n'est pas atteignable en raison des dépendances externes (QA multi-comptes réelle, décisions propriétaire, validations avocat/DPO).

## Cause

Aucun défaut technique critique n'a été identifié dans les périmètres autorisés ; toutefois plusieurs exigences légales et procédurales restent conditionnées à des décisions propriétaire et à une validation professionnelle non exécutables ici.

## Readiness Phase 26.5

**READY WITH BLOCKERS** — les blocages (contact LCEN, avocat, DPO, âge minimum, politiques de sanction) sont non-techniques et propres au propriétaire.

## Publication

NON PUBLIÉ.
