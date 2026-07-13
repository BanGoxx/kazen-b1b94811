# Phase 13 — Private Member Chat: Feasibility & Security Plan

**Verdict: READY FOR APPROVAL.** A secure, RLS-provable, report-scoped 1:1 chat is achievable with the existing spine (SECURITY DEFINER RPCs + `requireSupabaseAuth` + `notify_member` + moderation enum). Nothing was implemented. No table, migration, Realtime change, route or UI was created. Explicit approval **is required** before any migration or code runs.

## 1. Architecture audit

- **Auth/session**: browser client (`supabase`) with RLS; `_authenticated/route.tsx` gate redirects unauthenticated users; server writes go through `requireSupabaseAuth` middleware (bearer attached via `attachSupabaseAuth` in `src/start.ts`). Reusable as-is.
- **Profiles**: `profiles` is `SELECT`-viewable-by-everyone; columns are display-only (`display_name, avatar_url, bio, preferred_*`). **Gap**: no `accepts_chat` preference and no member-block table exist.
- **Write pattern (reusable, proven)**: every mutation is a `SECURITY DEFINER` RPC with `SET search_path=public`, author derived from `auth.uid()`, length + rate-limit checks internal, exposed via thin `createServerFn` wrappers (see `playlist-reviews.functions.ts`). Chat will mirror this exactly. **No user INSERT/UPDATE grants** — reads via RLS, writes via RPC only.
- **Notifications**: `notify_member(_user,_type,_event_key,...)` respects `member_notification_preferences` (enabled/quiet/snooze) and dedupes on `event_key`. Reusable for chat events.
- **Moderation/report spine**: `moderation_target_type` enum (`review,reply,playlist,playlist_item,playlist_review`), `submit_content_report` + `moderate_content` (hide/unhide/soft_delete/restore into `moderation_actions`), owner-gated `can_moderate_now`, `/moderation` console with `TARGET_LABELS`. Reusable by adding `chat_message` (report-scoped only).
- **Realtime**: `supabase_realtime` publication currently has **zero tables** — Realtime is unused today. Enabling it is additive but deferred (see §8).
- **Rate limits**: forum RPCs already use `count(*) ... where created_at > now() - interval` pattern — reuse verbatim.
- **Unread/pagination/cache**: notification feed uses infinite scroll + `last_read_at`-style deltas; playlist reviews use page-size + load-more + batched `.in('id', ids)` profile joins (no N+1). Reuse both patterns.
- **Account deletion**: FKs to `auth.users` use `ON DELETE CASCADE` throughout — chat tables must do the same.

**Conclusion**: no destructive change needed; every requirement maps onto an existing, audited pattern. No moderator surveillance is required for a working product.

## 2. Recommended product rules (safest low-complexity)

- Start a conversation only from another member's **public profile**; recipient can **accept or ignore** a first-contact request.
- Per-member `accepts_chat` toggle (default on); when off, no new requests can be created against them.
- One conversation per unordered member pair — reopen the existing one instead of creating duplicates.
- Accepted → `active`; blocking → immediate hard stop, both directions.
- **Phase 1 excludes**: read receipts, typing indicators, attachments, embeds, voice/video, email, browser push.
- Message edit: author-only, within a window; delete: author-only soft delete. Conversation: archive (per-participant) + close.
- Retention: soft delete retained for moderation/audit; hard purge on account deletion via cascade.

## 3. Data model (additive — NOT applied)

```text
chat_conversations(id, status[pending|active|blocked|closed],
                   created_at, updated_at, last_message_at,
                   pair_key text UNIQUE)   -- sorted "uidA:uidB" enforces one-per-pair
chat_participants(conversation_id, user_id, joined_at,
                  last_read_at, muted_at, archived_at, blocked_at,
                  PRIMARY KEY(conversation_id, user_id))
chat_messages(id, conversation_id, sender_id, body,
              created_at, edited_at, deleted_at, moderation_state)
profiles.accepts_chat boolean NOT NULL DEFAULT true   -- single additive column
```
Reporting **reuses** `content_reports` + `moderation_target_type += 'chat_message'`; no `chat_reports` table. Blocking is chat-scoped via `chat_participants.blocked_at` (no global block table introduced in Phase 1).

**Constraints**: exactly two participants (enforced by RPC + `pair_key` uniqueness); `char_length(body) BETWEEN 1 AND 4000`; no raw HTML (rendered as text); no arbitrary sender; blocked participant cannot send.

## 4. RLS design

- `chat_participants` / `chat_conversations` SELECT: `EXISTS (participant row where user_id = auth.uid())` via a `SECURITY DEFINER` helper `is_chat_participant(conv, uid)` to avoid recursive cross-table cost.
- `chat_messages` SELECT: `is_chat_participant(conversation_id, auth.uid())` AND `deleted_at IS NULL OR sender_id = auth.uid()`.
- **No INSERT/UPDATE/DELETE policies for `authenticated`** — all writes via SECURITY DEFINER RPCs, so arbitrary sender_id, cross-user edits, and conversation enumeration are structurally impossible.
- Owner/moderator get **no** blanket read of private messages. Moderation reads are report-scoped only (a SECURITY DEFINER function returns just the reported message + bounded context when an open `content_report` references it).
- No ID guessing: unrelated user C reading a conversation returns empty under RLS.

## 5. RPC design (all `SECURITY DEFINER`, `SET search_path=public`, author from `auth.uid()`)

`request_conversation(_target)` · `accept_conversation(_id)` · `decline_conversation(_id)` · `send_chat_message(_conv,_body)` · `edit_chat_message(_id,_body)` · `delete_chat_message(_id)` · `mark_conversation_read(_id)` · `block_chat_member(_conv)` · `report_chat_message(_id,_reason,_details)` (wraps `submit_content_report`) · `archive_conversation(_id)`.

Each: validates participation, `accepts_chat`, not-blocked, length bounds, duplicate-send (`same body <2min`) and rate limits (`send ≤ 30/10min`, `request ≤ 10/15min`); idempotent request/accept; safe generic errors. Thin `createServerFn` wrappers in `src/lib/chat.functions.ts`.

## 6. Blocking

Chat-scoped, immediate, symmetric: sets `chat_participants.blocked_at` and conversation `status='blocked'`; sends fail server-side instantly; prior history stays readable to both; pending chat notifications for that pair suppressed; block state not leaked to the blocked member beyond a generic "conversation unavailable".

## 7. Reporting & moderation

Member reports a specific message → `content_reports(target_type='chat_message', target_id=message_id)`. Moderator queue shows only the reported message + a small bounded window fetched by a report-gated SECURITY DEFINER reader — no inbox browsing. Actions reuse `moderate_content`: warn, hide reported message, restrict sender, close conversation; all audited in `moderation_actions`. No silent global surveillance.

## 8. Realtime recommendation

Realtime is currently disabled (empty publication). **Preferred**: enable Supabase Realtime for `chat_messages`/`chat_participants` **only after approval**, gated by the same RLS (subscribers receive only rows they may read), with bounded reconnect and dedupe by message id. **Fallback**: bounded polling of `last_message_at` on the open conversation (e.g. 5s while focused, paused when hidden) — no hidden high-frequency polling, no external WebSocket provider. **Not enabled in this phase.**

## 9. Notification integration

Internal-only via `notify_member`, deduped by `event_key`, preference-gated: `chat_request`, `chat_request_accepted`, `chat_message` (coalesced per conversation, not per message; no edit/delete notifications). No email, no push. Unread count derived from `last_read_at` vs `last_message_at`.

## 10. UI plan

New `/messages` inbox (route `src/routes/_authenticated/messages.tsx` + `messages.$id.tsx`): conversation list, pending-requests section, active thread, unread badges, empty/loading/error/blocked states, responsive (list→thread on mobile). Entry point: a "Message" action on public profiles. Preserves black + metallic-crimson DA, existing tokens only; no floating overlay, no Discord clone, no forum/notification impact.

## 11. Performance

Paginated conversations (order by `last_message_at DESC`, indexed); message page size 30 + load-older; batched profile join; optimistic send with rollback and id-dedupe; per-conversation subscription only (no global subscription); no full-history fetch.

## 12. Retention & deletion

Soft delete for messages/conversations (moderation audit); user-deleted message shows "message supprimé" placeholder to both; archive is per-participant. Account deletion → cascade purge of participant rows and authored messages. No false privacy promises (backups outside app control are disclosed).

## 13. Abuse prevention

Send + request rate limits, duplicate-message detection, plain-text only, max length 4000, link sanitization (no auto-embed), block/report, spam cooldown, no attachments in Phase 1.

## 14. Migration plan (approval-ready, additive, NOT applied)

Single migration, in order: (1) `ALTER TYPE moderation_target_type ADD VALUE 'chat_message'` — committed before use (split so enum precedes RPC patch); (2) `ADD COLUMN profiles.accepts_chat`; (3) `CREATE TABLE` chat_conversations/participants/messages with checks (`body` length, `pair_key` unique) and cascade FKs; (4) `GRANT SELECT` to `authenticated`, `GRANT ALL` to `service_role` (no anon, no write grants); (5) indexes (`chat_messages(conversation_id, created_at DESC)`, `chat_conversations(last_message_at DESC)`, participant `(user_id)`); (6) `ENABLE ROW LEVEL SECURITY` + SELECT-only policies per §4; (7) SECURITY DEFINER helpers + RPCs per §5 with `GRANT EXECUTE ... TO authenticated`; (8) `updated_at` trigger; (9) patch `moderate_content`/`submit_content_report` with a `chat_message` branch. **Realtime publication change deferred** to a follow-up flagged step. **Rollback**: `DROP TABLE ... CASCADE` + `DROP FUNCTION` + revert moderation branch + drop `accepts_chat`; the enum label is inert once unreferenced (Postgres cannot drop enum values cleanly — documented, harmless).

## 15. QA matrix

A requests B · B accepts · B declines · duplicate request (idempotent) · A sends / B replies · A edits own · B cannot edit A's · A soft-deletes own · unrelated C reads nothing · blocked cannot send · direct RPC spoof (arbitrary sender/participant) rejected · duplicate send blocked · 100+ messages pagination · reconnect/realtime failure fallback · report → report-scoped moderation only · account deletion cascade · mobile · dark/light · no DA regression · `tsgo` typecheck.

## 16. Stop-condition review

None triggered: RLS is provable (SELECT gated by participation, writes RPC-only), block/report enforced server-side, message access limited to participants, no default moderator surveillance, Realtime deferred and RLS-scoped, rate limiting reuses proven pattern, deletion semantics defined, migration is fully additive.

## 17. Files expected to change (after approval)
New: one migration; `src/lib/chat.ts` (hooks); `src/lib/chat.functions.ts`; `src/routes/_authenticated/messages.tsx`; `src/routes/_authenticated/messages.$id.tsx`; a profile "Message" entry component.
Edited (minimal): `src/lib/moderation.functions.ts` (union + snapshot branch); `src/routes/_authenticated/moderation.tsx` (`TARGET_LABELS`); navigation to add a Messages link.

**Confirmation**: no code, schema, migration, Realtime, or publish action was performed in this phase. Explicit approval is required before any implementation.