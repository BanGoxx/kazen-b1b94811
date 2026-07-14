# KAZEN Phase 25 — External Multi-Account QA Runbook

Verdict at the end of preparation: **READY FOR EXTERNAL QA**.

The composite `(created_at, id)` pagination fix is in place, polling is now
gated on Realtime health, and blocked-author events are filtered before render
(no visible flash, no unread increment). No product features were added, no
RLS/RPCs/Realtime publication were changed, no test backdoors exist.

**Do not publish** until every scenario in §5 is PASS or explicitly waived.

---

## 1. Test-account matrix

Use existing sign-up + role/restriction flows. Do NOT commit credentials.

| Label | Role / state                        | How to obtain                                                                 |
| ----- | ----------------------------------- | ----------------------------------------------------------------------------- |
| A     | Established member (>7 days)        | Existing seasoned account. If none exists, seed one and let account age.      |
| B     | Established member (>7 days)        | Second seasoned account, different email.                                     |
| N     | New member (<7 days)                | Sign up a fresh email just before the session.                                |
| C     | Restricted member                   | Any normal member; Owner or Moderator restricts them via `/moderation`.       |
| M     | Moderator                           | Owner promotes an account via existing role console (`user_roles` = moderator). |
| O     | Owner / Fondateur                   | The existing Owner account.                                                   |
| X     | Anonymous                           | Fresh incognito window, signed out.                                           |

Never paste credentials into this repo, PRs, screenshots, or logs.

---

## 2. QA panel decision

**Decision: no in-app QA panel.** Adding an Owner-only diagnostics surface
requires new UI, new queries, and a maintenance/removal step for a
temporary feature. The existing Founder Console + browser devtools already
expose enough signal (Network → WebSocket frames, React Query devtools if
enabled, `document.visibilityState`, and the connection pill in the chat
header). We keep this document as the checklist instead.

The chat header already exposes: **En direct / Connexion… / Reconnexion… /
Hors ligne**, room read-only badge, and per-user restriction banner. These
are sufficient for manual observation.

---

## 3. Diagnostics added

None permanent. If a tester needs deeper trace on a preview build, they
may temporarily add `console.debug` lines to `src/lib/live-chat.ts`
around `applyStatus` and `refetchInterval`, and REMOVE them before merge.
No log line should contain a message body, email, token, user id of a
third party, or moderation report content.

---

## 4. Manual session setup

Independent sessions require independent storage partitions. Same tab, or
same browser profile with account switching, is **not** sufficient — the
Supabase session in `localStorage` is shared.

Recommended setup for a single machine:

1. Chrome (default profile) — Account A.
2. Chrome (second profile via `chrome://settings/manageProfile`) — Account B.
3. Firefox — Account N.
4. Chrome Incognito — Account X (signed-out) or Account C.
5. Safari / Edge — Account M or O.

Each browser/profile has its own `localStorage`, cookies, and WebSocket
pool, giving true concurrency.

Role/restriction setup:

- Promote M to moderator: Owner opens `/moderation` (or the existing role
  admin surface) and adds `moderator` in `user_roles` for M.
- Restrict C: Moderator or Owner uses the dropdown on one of C's messages
  → "Restreindre" (or calls `restrict_live_chat_member` from the moderation
  panel). Set a short window, e.g. 5 minutes.

---

## 5. Multi-account test script

Record results in the template in §6. Expected results are the pass bar.

### A. Anonymous isolation (X)

1. X opens `https://<preview>/communaute/direct`.
   - Expected: redirected to `/auth` by the `_authenticated` gate.
2. X calls `send_live_chat_message` RPC directly from browser console using
   the anon key (already in `client.ts`).
   - Expected: RPC fails; no row appears.
3. X opens a Supabase Realtime channel for `live_chat_messages` from console.
   - Expected: no rows delivered (RLS blocks anon SELECT).

### B. Normal Realtime (A + B)

1. A and B open `/communaute/direct` simultaneously; both show "En direct".
2. A sends message `qa-b-1`.
   - Expected on A: one row, no duplicate.
   - Expected on B: same row appears live within ~1s, same `id`.
3. B replies to A's message.
   - Expected on A: reply appears live with correct quoted body preview.

### C. Edit and delete (A + B)

1. A edits `qa-b-1` → `qa-b-1 edited`.
   - Expected on B: body updates; "Modifié" label visible.
2. A deletes `qa-b-1 edited`.
   - Expected on B: placeholder replaces body; original body no longer
     visible in normal UI.
3. B attempts to edit or delete A's message via dropdown / RPC.
   - Expected: option hidden in UI; direct RPC returns error.

### D. New-account limits (N)

1. N sends 3 messages back-to-back as fast as possible.
   - Expected: first goes through; subsequent within 8s rejected with a
     clear French error toast; 9th within 60s rejected; 51st within 1h
     rejected.

### E. Established-account limits (A)

1. A sends messages rapidly.
   - Expected: minimum interval 3s, 20/min, 150/h.

### F. Concurrent tabs (A)

1. A opens the room in two tabs of the same browser profile.
2. Sends nearly simultaneously in both.
   - Expected: rate limit is transaction-safe; only one send per tick.

### G. Blocking (A blocks B)

1. A blocks B (dropdown → "Bloquer").
   - Expected on A: B's existing messages disappear (client-side filter);
     no unread increment; no new B message ever appears visibly on A;
     no reply preview surfaces on A.
   - Expected on M / O / other members: B remains visible.
   - Documented limitation: Realtime channel still delivers B's rows to A;
     visibility is enforced at render time (`displayMessages` filter).

### H. Restriction (M/O restricts C)

1. M restricts C for 5 minutes.
   - Expected on C: red banner "Envoi restreint jusqu'à…"; input disabled.
2. C attempts to call `send_live_chat_message` from console.
   - Expected: RPC returns error.
3. Wait until expiry (or clear via `unrestrict_live_chat_member`).
   - Expected on C: banner disappears; sending works.

### I. Moderation (A reports, M acts)

1. A reports one of B's messages with a reason.
   - Expected: toast "Signalement transmis". Row appears in `forum_reports`
     / moderation queue.
2. M opens the moderation queue.
   - Expected: bounded context (message body, room, reporter reason). No
     unrelated PII.
3. M hides the message, then restores it.
   - Expected on all viewers: hidden → placeholder; restored → body back.
   - Ordinary member calling `hide_live_chat_message` from console.
   - Expected: RPC error.

### J. Kill switch (O)

1. O flips the room to read-only (Founder Console → `set_live_chat_room_active`
   false, or dropdown on the room).
   - Expected: "Lecture seule" badge in header; input disabled with
     "Envoi indisponible" placeholder.
2. Any account calls `send_live_chat_message` from console.
   - Expected: RPC returns a clear French error message.
3. M or ordinary member attempts to toggle back.
   - Expected: RPC returns error (Owner-only).

### K. Session lifecycle (A)

1. Leave A on the room for ~1 hour to observe a token refresh.
   - Expected: no visible break; header stays "En direct"; no re-login.
2. In devtools, throttle → Offline.
   - Expected: header → "Hors ligne" or "Reconnexion…". Polling fallback
     resumes (see §7).
3. Restore network.
   - Expected: header → "En direct" within a few seconds; polling stops
     (see §7); no duplicate messages after reconnect.
4. System sleep 5 min → wake.
   - Expected: same reconnect behaviour, no duplicate rows.
5. A signs out from another tab.
   - Expected: on the chat tab, root `onAuthStateChange` fires; router
     invalidates; A is redirected to `/auth`; no further Realtime events
     are processed. Channel is removed on unmount.

---

## 6. Evidence template

Copy-paste one block per test.

```
Test ID:            (A / B1 / B2 / C1 / … / K5)
Account/context:    (A on Chrome default / B on Chrome profile 2 / …)
Date/time (Europe/Paris):
Browser + version:
Action:
Expected result:
Observed result:
Verdict:            PASS | PARTIAL | BLOCKED
Screenshot ref:     (local filename, do not commit unless scrubbed)
Console/network:    (WS frame count, RPC status codes — no bodies)
Defect ID:          (link to issue if any)
```

Do not attach screenshots to this repo unless scrubbed of emails, tokens,
and third-party message bodies.

---

## 7. Polling verification

Current behaviour after this pass:

- `useLiveChatMessages` sets `refetchInterval: rtConnected ? false : 20_000`.
- `useLiveChatRealtime` mirrors its socket state into a module-level
  registry keyed by `roomId`; `useLiveChatMessages` reads through
  `useRealtimeConnected(roomId)`.
- Result: while Realtime is `connected`, polling is off. While
  `idle` / `connecting` / `reconnecting` / `disconnected`, polling runs at
  20s. On reconnect, `SUBSCRIBED` immediately stops polling.
- Background polling is still disabled (`refetchIntervalInBackground: false`).

How to verify in devtools:

1. Open `/communaute/direct`; Network tab, filter by
   `live_chat_messages`. When header shows "En direct", there should be
   exactly one initial page load and no periodic REST poll to the table.
2. Throttle → Offline; header goes to "Hors ligne"/"Reconnexion…". A
   REST request appears roughly every 20s.
3. Restore network; header goes back to "En direct"; periodic REST
   requests stop.

Private 1:1 chat polling is **not** touched.

---

## 8. Blocked-message cache verification

Current behaviour:

- `useBlockedMemberIds` loads the viewer's `member_blocks` set once
  (5 min stale time).
- `communaute.direct.tsx` computes `displayMessages` by filtering out any
  `m.author_id` in the blocked set (except the viewer's own).
- All rendered surfaces — the message list, unread divider position, and
  the reply-preview lookup — flow through `displayMessages`.

Result on the blocker:

- No visual flash: blocked authors are filtered before the React tree
  mounts them (filter is in the same synchronous render).
- No unread increment: the divider index is computed on `displayMessages`.
- No reply notification: replies referencing a blocked author's row are
  themselves rendered normally, but the quoted preview lookup uses the
  full `messages` list only to resolve the referenced body; blocked
  authors' own new messages never render.

Recipient-side Realtime suppression is **not** claimed: the socket still
delivers rows for blocked authors; suppression is enforced at render time.
Testers must observe absence of visual/unread impact, not absence of the
WebSocket frame.

---

## 9. Preview-only QA

- Preview URL: use the current Lovable preview. Confirm in the browser
  URL bar before starting each test.
- Shared database: preview and production point at the same Lovable Cloud
  database. Any test message, restriction, or report you create persists
  until cleaned up (see §10).
- No frontend code was changed on production during this pass; only the
  files listed in §11 are dirty and require deploy to reach prod.
- Migrations already applied: `live_chat_rooms`, `live_chat_messages`,
  `live_chat_member_state`, associated RLS + RPCs, and the
  `supabase_realtime` publication add for `live_chat_messages`. No new
  migration in this pass.

---

## 10. Cleanup plan

After QA:

- Test messages: Owner uses `hide_live_chat_message` (soft-hide, preserved
  for audit) for anything unwanted, or leaves them if the retention policy
  is "keep everything". Do NOT hard-delete moderation evidence.
- Test restrictions: Owner or Moderator calls
  `unrestrict_live_chat_member(_room, _user)` for C.
- Test reports: leave in the moderation queue with a "QA — resolved"
  note; do not purge.
- Temporary debug logs: if any tester added `console.debug` lines to
  `src/lib/live-chat.ts`, remove them before merging.
- Development-only flags: none introduced.

---

## 11. Change summary this pass

Files changed:

- `src/lib/live-chat.ts` — added `RtStatus` registry + `useRealtimeConnected`;
  `useLiveChatMessages` now gates `refetchInterval` on Realtime health;
  `useLiveChatRealtime` publishes status into the registry and clears it
  on unmount.
- `docs/phase-25-external-qa.md` — this runbook.

No changes to: RLS, RPCs, Realtime publication, `communaute.direct.tsx`
UI, private 1:1 chat, AI assistant, global navigation, DA tokens.

Nothing was published automatically.

---

## 12. Exit criteria for Phase 25 PASS

Phase 25 flips from PARTIAL → PASS when **all** are true:

1. Sections A–K in §5 recorded as PASS with the §6 template.
2. §7 polling behaviour verified live (poll off while connected, on while
   disconnected, off again on reconnect).
3. §8 blocked-cache behaviour verified live (no flash, no unread, no
   reply preview leak on the blocker's side).
4. No regression observed on private 1:1 chat, AI assistant, discovery,
   catalog, calendar, fiches, forum, moderation queue, or the DA.
5. Owner explicitly approves publish.
