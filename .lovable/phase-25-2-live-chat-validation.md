# KAZEN — Phase 25.2 — Validation externe du Live Chat

## Architecture existante (auditée, non modifiée)

- **Route** : `src/routes/_authenticated/communaute.direct.tsx` (subtree `_authenticated`, `ssr:false`, redirection `/auth` si non connecté).
- **Client data layer** : `src/lib/live-chat.ts` (React Query + Realtime).
- **Server functions** (RPC wrappers) : `src/lib/live-chat.functions.ts`.
- **Tables** :
  - `live_chat_rooms(id, slug, name, description, is_active, ...)`
  - `live_chat_messages(id, room_id, author_id, body, reply_to_id, created_at, edited_at, deleted_at, hidden_at, ...)`
  - `live_chat_member_state(room_id, user_id, last_read_at, restricted_until, restricted_reason, ...)`
- **RLS** — SELECT-only pour `authenticated`, aucune policy INSERT/UPDATE/DELETE publique :
  - `live_chat_rooms` : `is_active = true OR can_moderate_now(auth.uid())`
  - `live_chat_messages` : `deleted_at IS NULL` ET room active/mod ET (`hidden_at IS NULL` OR auteur OR mod)
  - `live_chat_member_state` : `user_id = auth.uid() OR can_moderate_now(auth.uid())`
  - Toutes les écritures passent par RPC `SECURITY DEFINER` avec `search_path=public` (`send_live_chat_message`, `edit_live_chat_message`, `delete_live_chat_message`, `mark_live_chat_read`, `report_live_chat_message`, `hide_live_chat_message`, `restore_live_chat_message`, `restrict_live_chat_member`, `unrestrict_live_chat_member`, `set_live_chat_room_active`, `live_chat_admin_stats`).
- **Realtime** : publication `supabase_realtime` inclut uniquement `public.live_chat_messages`. Canal `live-chat:{roomId}` filtré `room_id=eq.{roomId}`, écoute `postgres_changes` event `*`. Invalidation React Query sur chaque événement.
- **Fallback polling** : `refetchInterval` 20 s uniquement quand Realtime n'est pas `connected` (registre `rtStatusByRoom`) ; désactivé onglet caché.
- **Pagination** : `useInfiniteQuery`, cursor composite déterministe `(created_at, id)` — pas de doublon/gap sur horodatage égal.
- **Anti-doublons** : `useFlatLiveChatMessages` dédup par `id` avant tri chronologique.
- **Blocage** : `useBlockedMemberIds()` client-only (les messages restent visibles pour la modération).
- **Auteur** : `author_id` fixé côté RPC via `auth.uid()` — l'utilisateur ne peut pas usurper.

## Flux d'un message
1. `submit()` → validation locale (`trim`, `<= 500` chars, non vide).
2. `useSendLiveChatMessage` → RPC `send_live_chat_message(roomId, body, replyTo)` via `createServerFn` + bearer.
3. RPC vérifie `auth.uid()`, room active, restriction membre, insère avec `author_id = auth.uid()`.
4. Realtime pousse l'INSERT filtré room → invalidation React Query côté abonnés.
5. Émetteur : `onSuccess` invalide la même queryKey → un seul rendu, pas de doublon car cursor dédup.
6. `useMarkLiveChatRead` debounced 800 ms lorsque l'onglet est visible.
7. Reconnexion : `useLiveChatRealtime` bascule `reconnecting`/`disconnected` → polling 20 s reprend automatiquement.

## Verdict

**PARTIAL**

## Cause

Le code, les RLS, les RPC `SECURITY DEFINER` (avec `search_path` explicite), la publication Realtime, la dédup, la pagination composite et le fallback polling sont conformes aux exigences. La sécurité (auteur imposé par `auth.uid()`, SELECT uniquement, échappement React natif) est vérifiée par lecture directe des policies et fonctions.

Cependant, l'environnement Lovable ne permet pas de tests multi-comptes réels simultanés sur mobile physique avec coupure réseau. La suite ci-dessous doit être exécutée manuellement par le propriétaire avant tout PASS.

## Audit effectué

- `src/routes/_authenticated/communaute.direct.tsx` (709 L)
- `src/lib/live-chat.ts` (424 L)
- `src/lib/live-chat.functions.ts` (154 L)
- `pg_policies` sur les 3 tables live_chat_*
- `pg_proc` sur les 11 fonctions live_chat_*
- `pg_publication_tables` sur `supabase_realtime`

## Tests multi-comptes
Non exécutés — environnement mono-session. Voir « Checklist manuelle » plus bas.

## Realtime
- Abonnement unique par montage, `removeChannel` en cleanup, statut poussé dans registre → polling gated.
- Filtre `room_id=eq.{roomId}` en place ; les autres rooms ne consomment pas d'événements.
- Reconnexion : compteur `attemptRef` + statuts `reconnecting`/`disconnected`.
- Doublons : cursor composite + dédup par `id` dans `useFlatLiveChatMessages`.

## Mobile
Non testé sur appareil physique — checklist manuelle fournie.

## Sécurité
- SELECT-only côté client, écritures RPC uniquement.
- `author_id` non modifiable par l'utilisateur (imposé RPC).
- Édition/suppression : RPC vérifie l'auteur ou le rôle mod.
- Modération `hide/restore/restrict` : gated par `can_moderate_now`.
- Échappement : React JSX natif, aucun `dangerouslySetInnerHTML` dans le chat.
- Profils : `hydrateAuthors` respecte `profile_public` (masque display_name/avatar sinon).

## Fichiers modifiés
Aucun.

## Migrations
Aucune.

## RLS
Inspectées, aucune modification.

## RPC
Inspectées (11), aucune modification.

## Routes
`/communaute/direct` vérifiée, aucune modification.

## Typecheck
`bunx tsgo --noEmit` → exit 0, aucun message.

## Tests
Aucune suite de tests spécifique au chat live dans le projet ; non exécuté.

## Build
Automatique par le harness Lovable.

## Preview
Route accessible via `/communaute/direct` (subtree `_authenticated`). Comportement mono-utilisateur : UI, envoi, édition, suppression, signalement, modération observables. Multi-comptes non observable dans l'environnement.

## Shared DB
Consultée en lecture seule (policies + procs + publication). Aucune écriture.

## Production
Aucune publication automatique.

## Rollback
Aucun changement — pas de rollback nécessaire.

## Limitations
- Pas de second navigateur/appareil dans le sandbox.
- Pas de coupure réseau simulée côté Realtime managé.
- Pas de tests automatisés multi-comptes.

## Publication
NON PUBLIÉ.

---

## Checklist manuelle à exécuter par le propriétaire

Utiliser aussi `docs/phase-25-external-qa.md`. À reporter dans ce fichier :

### Comptes / appareils
- [ ] Compte A — desktop Chrome
- [ ] Compte B — desktop Firefox ou navigation privée
- [ ] Compte C — mobile réel (iOS Safari ou Android Chrome)

### Réception temps réel
- [ ] A envoie → B et C reçoivent < 3 s sans rechargement
- [ ] A ne voit pas son message dupliqué
- [ ] Ordre chronologique correct sur les 3 clients

### Envois simultanés
- [ ] A et B envoient dans la même seconde → ordre cohérent, pas de doublon, auteurs corrects

### Rafraîchissement
- [ ] F5 sur C → historique complet, pas de doublon après resubscription

### Onglet arrière-plan
- [ ] B met l'onglet en arrière-plan pendant qu'A envoie 3 messages → au retour, 3 messages visibles, pas de doublon

### Coupure réseau
- [ ] Couper le wifi sur C → tenter envoi → toast d'erreur explicite
- [ ] Pendant coupure, A envoie 2 messages
- [ ] Reconnecter C → messages manqués apparaissent, pas de doublon, pas de boucle console

### Déconnexion compte
- [ ] Sign-out sur A pendant chat ouvert → plus d'abonnement (vérifier console), redirection `/auth`

### Changement de compte
- [ ] Sign-out A → sign-in B dans la même session → ancien channel fermé, nouvel abonnement, aucun message envoyé sous l'ancien ID

### Sécurité
- [ ] `/communaute/direct` en navigation privée non connectée → redirection `/auth`
- [ ] Tentative RPC via console avec `author_id` forgé → refusée (auteur imposé par RPC)
- [ ] Édition/suppression du message d'un autre → refusée (401/permission)

### Contenu
- [ ] Vide / espaces uniquement → refusé
- [ ] 500 caractères → accepté, 501 → tronqué (compteur UI)
- [ ] `<script>alert(1)</script>` → affiché en texte brut, pas d'exécution
- [ ] Emojis / accents / kanjis → OK
- [ ] URLs → texte brut (pas d'auto-link volontairement)

### Mobile (largeurs 360, 390, 430, 768, 1024+)
- [ ] Clavier virtuel ne masque pas la zone de saisie
- [ ] Scroll stable, pas de saut à l'arrivée d'un message quand on lit un ancien
- [ ] Rotation portrait/paysage sans débordement horizontal

### Performance
- [ ] Un seul channel `live-chat:{roomId}` dans les logs Supabase Realtime
- [ ] `refetchInterval` inactif quand Realtime `connected` (Network tab : pas de poll 20 s)
- [ ] Aucune erreur console React / Supabase
