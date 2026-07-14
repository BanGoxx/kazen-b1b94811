# KAZEN Phase 25 — Authenticated Community Live Chat: Feasibility & Security Audit

**VERDICT: READY FOR APPROVAL** (implementation-ready; nothing built yet).

Realtime event isolation *can* be proven (per-table publication + RLS-gated broadcast), rate limits and moderation are server-enforceable with the existing `SECURITY DEFINER` pattern, and no destructive migration is required. This is an approval-ready blueprint only — no code, migration, Realtime, or publish action was performed.

---

## 1. Architecture audit (what exists, what to reuse)

| System | State today | Reuse for live chat? |
|---|---|---|
| Auth | Supabase, `_authenticated/route.tsx` gate (`ssr:false`, redirect `/auth`) | **Reuse** — chat route lives under `_authenticated/` |
| Profiles | Public columns locked; `get_public_profile` RPC exposes only `display_name`, `avatar_url`, `bio` | **Reuse** — join safe columns only |
| Public badges | `public_badges` / `user_public_badges` | **Reuse** for author badge chips |
| Forum | `forum_*` tables, own moderation | Separate; not merged |
| Private 1:1 chat | `chat_conversations/participants/messages`, RPC-only writes, 10s/25s polling, **Realtime OFF** | **Do NOT touch** — fully separate tables/RPCs |
| Block system | `member_blocks` + `set_member_block(_target,_blocked)` | **Reuse** for local hide + send-guard |
| Moderation spine | `content_reports`, `moderation_actions`, `moderate_content`, `resolve_report`, `can_moderate_now(uid)` (currently owner-only), enum `moderation_target_type` = review/reply/playlist/playlist_item/playlist_review/**chat_message**; `moderation_action_type` = hide/unhide/soft_delete/restore/lock/unlock/warn/timeout/dismiss_report | **Reuse** — add `live_chat_message` enum value + a `restrict`/`unrestrict` handling |
| Rate limits | Convention: recent-count guard inside `SECURITY DEFINER` RPC (`send_chat_message`: 30/10min, dup within 2min) | **Reuse pattern**, tighter values |
| Notification center | `notify_member(...)` dedup by `event_key`; server-only inserts | Reuse **sparingly** (replies/moderation only) |
| Realtime | `supabase_realtime` publication has **zero tables** — nothing streams today | Enable **only** `live_chat_messages` later |
| Founder Console | `/fondateur` + `can_moderate_now` gating | **Reuse** — add compact live-chat panel |
| Profile privacy | Private fields already restricted | Chat exposes only safe columns |

**Conclusion:** ~80% reuse. New: 3 tables, one enum value, RPC set, one route, one Founder panel, one nav entry.

---

## 2. Access rules (all server-enforced)

- **Anonymous:** cannot read/enumerate/send. Public route shows a sign-in invitation only.
- **Member:** read active room, send, edit/delete own only, block, report. No moderation.
- **Moderator** (`can_moderate_now`): hide/restore messages, restrict/unrestrict posting, resolve reports, bounded context only. No access to private 1:1 tables, no private profile fields.
- **Owner:** ultimate authority + kill switch; nothing above.

---

## 3. Route & navigation

- **Route:** `src/routes/_authenticated/chat.tsx` → `/chat` (auth-gated by existing layout; keeps it cleanly separate from `/messages` and `/communaute`).
- **Nav:** single entry **"Chat en direct"** with a small **Bêta** badge, placed inside the Communauté area of `AppShell` (desktop + mobile menu). No main-nav overload, no floating overlay.

---

## 4. Data model (proposal — DO NOT APPLY)

```text
live_chat_rooms
  id uuid pk default gen_random_uuid()
  slug text unique          -- 'general'
  name text                 -- 'Général KAZEN'
  description text null
  is_active boolean default true   -- read-only kill switch when false
  created_at timestamptz default now()

live_chat_messages
  id uuid pk default gen_random_uuid()
  room_id uuid -> live_chat_rooms(id)
  author_id uuid -> auth.users(id)   -- set by RPC = auth.uid()
  body text                          -- <=500 chars, plain text
  reply_to_id uuid null -> live_chat_messages(id)
  created_at timestamptz default now()
  edited_at timestamptz null
  deleted_at timestamptz null
  hidden_at timestamptz null
  hidden_by uuid null
  index (room_id, created_at desc)

live_chat_member_state
  room_id uuid, user_id uuid  (pk composite)
  last_read_at timestamptz null
  muted_at timestamptz null          -- local per-user notification mute
  restricted_until timestamptz null  -- moderator-set posting restriction
```

Reports reuse `content_reports` via **new enum value `live_chat_message`** on `moderation_target_type` (`ALTER TYPE ... ADD VALUE` — additive, non-destructive). Constraints (author from `auth.uid()`, non-empty bounded body, plain text, valid+active room, reply target same room, soft delete/hide) enforced in RPCs + triggers, not client.

---

## 5. RLS design

Every new public table gets GRANTs + RLS in the same migration (no anon grant).

```
live_chat_rooms
  SELECT to authenticated: is_active = true (read-only listing)
live_chat_messages
  SELECT to authenticated:
    exists(room active) AND deleted_at IS NULL
    AND (hidden_at IS NULL OR author_id = auth.uid() OR can_moderate_now(auth.uid()))
  INSERT/UPDATE/DELETE: NONE for authenticated  -> RPC-only writes
live_chat_member_state
  SELECT/UPSERT to authenticated: user_id = auth.uid() only
```

- No broad `TO anon` policy anywhere.
- Moderator visibility of hidden rows via `can_moderate_now`, not a wildcard.
- Writes exclusively through `SECURITY DEFINER` RPCs → no client-forged author, no client moderator privilege.

---

## 6. RPC / server functions

All `SECURITY DEFINER SET search_path=public`, identity from `auth.uid()`, French errors, bounded inputs (mirrors `send_chat_message`).

| RPC | Guards |
|---|---|
| `send_live_chat_message(_room,_body,_reply_to)` | auth; room active; not `restricted_until>now()`; body 1–500 after control-char strip; reply target in same room; cooldown + burst + duplicate checks |
| `edit_live_chat_message(_id,_body)` | author only; not deleted/hidden; length; sets `edited_at` |
| `delete_live_chat_message(_id)` | author only; sets `deleted_at` (soft) |
| `mark_live_chat_read(_room)` | upsert own `member_state.last_read_at` |
| `report_live_chat_message(_id,_reason,_details)` | routes to `submit_content_report('live_chat_message',...)`; idempotent per (reporter,message) |
| `hide_live_chat_message(_id,_reason)` | `can_moderate_now`; sets hidden_at/hidden_by; logs `moderate_content` |
| `restore_live_chat_message(_id)` | `can_moderate_now`; clears hidden; audited |
| `restrict_live_chat_member(_user,_until,_reason)` | `can_moderate_now`; sets `restricted_until`; audited |
| `unrestrict_live_chat_member(_user)` | `can_moderate_now`; audited |

Server functions wrap each in `src/lib/live-chat.functions.ts` with `requireSupabaseAuth` (bearer already registered in `src/start.ts`).

Server-fn wrappers expose: `sendLiveChatMessage`, `editLiveChatMessage`, `deleteLiveChatMessage`, `markLiveChatRead`, `reportLiveChatMessage`, `hideLiveChatMessage`, `restoreLiveChatMessage`, `restrictLiveChatMember`, `unrestrictLiveChatMember`.

---

## 7. Realtime architecture

**Provable isolation → not BLOCKED.** Approach:
- Enable Realtime for **only** `public.live_chat_messages` (`ALTER PUBLICATION supabase_realtime ADD TABLE`). Private-chat tables stay out of the publication, so no private events can leak.
- Client subscribes to **one** channel filtered `room_id=eq.<general>`, inside `useEffect`, torn down on unmount (per project realtime rule); no global/table-wide subscriptions.
- RLS on the table gates row delivery to authenticated subscribers.
- Initial history via paginated query; Realtime only appends new rows; dedupe by message `id`; targeted `queryClient` cache merge.
- Fallback: on disconnect, bounded exponential reconnect (cap ~30s, max attempts) + a manual "Rafraîchir" button + one low-frequency (~30s) refetch while disconnected. No infinite loop, no hidden high-frequency polling.

**Realtime is NOT enabled in this audit.**

---

## 8. Message + anti-spam rules (recommended, justified)

- Body ≤ **500** chars, plain text; control chars stripped (same regex as `send_chat_message`); URLs shown as plain text, **no** auto rich previews; no HTML/Markdown execution; no attachments.
- Edited indicator; deleted → "Message supprimé" placeholder; hidden → "Message masqué par la modération".
- Normal accounts: **1 msg / 3s**, ≤ 20/min, ≤ 150/hour, duplicate blocked if identical within 2 min.
- New accounts (<7 days, from `auth.users.created_at`): **1 msg / 8s**, ≤ 8/min, ≤ 50/hour. Stricter tier deters throwaway-account flooding during open beta; values tunable via constants.
- Never silently censor normal words — limits are rate/format only.

History: initial page 30–50, cursor pagination on `(room_id, created_at)`, max retained in client memory (e.g. 200) to bound memory.

---

## 9. Blocking behavior

- Reuse `member_blocks`. Blocked authors' messages are **hidden locally for the blocker only** (client filter using the blocker's own block list) — never removed globally.
- Blocked member cannot mention or open private 1:1 with the blocker (existing 1:1 RPC already honors blocks).
- Block metadata never exposed to others. One member cannot silence another for everyone.

---

## 10. Reporting & moderation

- Reuse `content_reports` + `moderation_actions` with new `live_chat_message` target type. Moderator queue (extend `moderationQueue`/`loadTargetSnapshot`) shows reported message, author, room, **bounded surrounding context** (report-scoped, like existing `moderation_chat_context`), reason, prior live-chat actions.
- Moderators never receive private 1:1 messages, full private profiles, or unrelated activity.
- Actions: hide / restore / warn / restrict-temporarily / close report — **every action audited** in `moderation_actions`. No automatic account deletion, no auto provider moderation.

---

## 11. Retention

- Recent history stays visible (paginated); no full-history fetch.
- Delete = soft (`deleted_at`); hidden rows retained for evidence with `hidden_by`.
- On account deletion: cascade or anonymize `author_id`; moderation records retained.
- No false promise of immediate backup deletion.

---

## 12. UI plan (`/chat`)

Reuse KAZEN black + metallic-crimson DA and existing primitives (`Avatar`, `ScrollArea`, `Textarea`, `Button`, `ReportDialog`). DA unchanged.

- Header: room name "Général KAZEN" + member-only + Bêta badge + connection status (Connecté / Reconnexion… / Lecture seule).
- Message list: author avatar + display name + public badges + timestamp; reply preview; edited/deleted/hidden states; unread divider from `last_read_at`.
- Composer: bounded textarea (500 counter), reply-to chip, disabled with clear French message when restricted or room read-only.
- Per-message menu: reply / edit-own / delete-own / report / block; moderator actions (hide/restore/restrict) for authorized roles.
- States: empty, loading, error, Realtime-disconnected + manual refresh.
- **Desktop:** centered readable column, optional compact context sidebar. **Mobile:** full-width, fixed keyboard-safe composer, no overlap with mascot / BackToTop / bottom nav (respect existing safe-area offsets). Not a Discord clone, no floating overlay, not mixed with `/messages`.

---

## 13. Notifications

First version: **no** per-message notification, no email, no push. Only reply-to-your-message and moderation outcome via existing `notify_member` (dedup key). Unread state kept per-room via `live_chat_member_state.last_read_at`.

---

## 14. Founder Console panel (Owner-only)

Compact section in `/fondateur`: room active/inactive toggle (kill switch), messages today, unique participants, rate-limit rejection events, unresolved reports, currently restricted members, Realtime health, emergency disable. **No** aggregate full transcript exposure — message content only via moderation-relevant views.

---

## 15. Kill switch

Server-enforced via `live_chat_rooms.is_active`. When false: `send_*` RPC raises; reads may remain (read-only). Owner-only update RPC. Member-facing French: **"Le chat en direct est temporairement en lecture seule."** No client-only flag.

---

## 16. Performance estimates

- 10 users: trivial. 100 users: one shared channel, ~indexed inserts, fine. 1,000 users: single-room fan-out is the main cost — mitigate with client dedupe, capped retained messages, cursor pagination, and rate limits capping insert throughput. Burst: rate limits + duplicate detection blunt floods; list virtualized only if measured need.
- Indexed `(room_id, created_at desc)`; bounded profile/badge lookup (batch, no N+1); optimistic send with rollback; stable ordering by `(created_at, id)`.

---

## 17. Migration plan (when approved)

1. `ALTER TYPE moderation_target_type ADD VALUE 'live_chat_message'` (additive).
2. Create 3 tables + GRANTs + RLS + policies (RPC-only writes).
3. Create `SECURITY DEFINER` RPCs (section 6).
4. Seed one room `general` / "Général KAZEN".
5. **Separately, after review:** add `live_chat_messages` to `supabase_realtime`.

## 18. Rollback plan

- Set room `is_active=false` (instant kill, no deploy).
- Remove table from publication to stop Realtime.
- Drop RPCs, then tables (all additive; nothing else depends on them). Enum value is harmless if left. No existing system touched → clean rollback.

---

## 19. QA matrix (to execute at implementation)

- **Auth:** anon read/send blocked; authed read/send OK; expired session redirect.
- **Messages:** send/edit-own/delete-own/reply; oversized & empty rejected; HTML/script neutralized; duplicate & rate-limit rejected.
- **Isolation:** no access to `chat_messages`/`chat_conversations`; no private profile fields; moderator spoof denied.
- **Realtime:** two users receive new msg; reconnect; duplicate event deduped; offline fallback; no infinite reconnect.
- **Blocking:** blocker-local hide; blocked can't bypass 1:1 restriction; not globally silenced.
- **Moderation:** report → bounded context → hide/restore/restrict → audited; ordinary member denied.
- **Responsive:** desktop/tablet/mobile, virtual keyboard, long messages & names, dark/light, reduced motion, no mascot/BackToTop overlap.
- **Performance:** 100+ msgs, 100-user sim, burst, pagination, no memory leak.

---

## 20. Expected files to change (implementation)

- New migration (tables, enum value, RPCs, room seed) — separate Realtime migration.
- `src/lib/live-chat.functions.ts` (server fns) + `src/lib/live-chat.ts` (client hooks, Realtime subscribe, pagination).
- `src/routes/_authenticated/chat.tsx` (UI).
- `src/components/layout/AppShell.tsx` (nav entry + Bêta badge).
- `src/lib/moderation.functions.ts` (`live_chat_message` snapshot + context).
- `src/routes/_authenticated/moderation.tsx` (queue support).
- `src/routes/_authenticated/fondateur.tsx` (diagnostics panel + kill switch).
- Optional: `src/components/chat/LiveChat*` presentational components.

---

## 21. Risks

- **Realtime fan-out at scale** — mitigated by single room, rate limits, client caps; revisit sharding/rooms only past beta.
- **Enum `ADD VALUE`** cannot run inside some transaction contexts — run in its own migration step.
- **Moderator visibility scope creep** — keep context strictly report-scoped like `moderation_chat_context`.
- **Mobile keyboard/safe-area overlap** — verified against existing mascot/BackToTop offsets during QA.

---

## Confirmation

No code was written, no table created, no migration applied, no enum altered, **Supabase Realtime was not enabled**, and nothing was published. This document is planning/audit output only, awaiting your approval.
