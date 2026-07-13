# KAZEN Master Roadmap — Autonomous Planning

Planning only. No code, no migrations, no publish, no email, no external config was changed.

---

## 1. Direct planning verdict

**PROCEED — autonomous execution is safe up to and including Phase F (Founder Console Phase 2).**
Everything from Phase A through F is additive, DB-only, and reuses existing architecture, so the Build agent can chain phases on PASS verdicts. **Phase G (email), Phase H (community/forum), and Phase I (chat) require explicit human approval gates** before or during execution. Phase J is verification-only.

## 2. Current architecture audit summary

Confirmed from the live tree:
- **Routing**: TanStack Start, `src/routes/*` flat convention; `_authenticated/` gate (`route.tsx`) protects `mes-listes`, `mes-playlists`, `notifications`, `import`, `fondateur`, `moderation`, `profil`.
- **Media/data**: `anilist.server.ts`, `anilist-public.ts` (browser fallback), `tmdb.server.ts`, `enrichment.ts/.functions.ts`, `franchise.ts`, `episodes.ts`, `next-episode.ts`, `news.ts`, `recommend.ts`, `queries.ts` (caching), `catalog-state.ts` (filter persistence).
- **Notifications (A1 done)**: `notifications.ts`, `notifications.functions.ts`, `use-notifications.tsx`, `components/notifications/*`, `/_authenticated/notifications.tsx`. Tables `member_notifications` (deduped by `event_key`), `member_notification_preferences`.
- **Lists/community primitives already present in DB**: `list_items`, `playlists`, `playlist_items`, `playlist_likes`, `fiche_reviews`, `review_replies`, `review_likes`, `reply_likes`, `media_requests`, `content_reports`, `moderation_actions`, `user_roles`, `public_badges`, `user_public_badges`.
- **Import/export**: `lib/import/*` (MAL, Nautiljon, AniList, JSON/CSV, match), `import.functions.ts`, `export.functions.ts`, tables `import_batches`, `import_items`.
- **Email (Ready-but-Unconfigured)**: `lib/email/*` (eligibility, provider.server, render-digest, unsub-token.server), `email-delivery.functions.ts`, `email-prefs.functions.ts`, `unsubscribe.functions.ts`, `/desabonnement`, `FounderTestSender.tsx`. Tables `member_email_preferences`, `email_delivery_logs`. Hard gate requires `EMAIL_SENDER_VERIFIED` + `EMAIL_REAL_SEND_ENABLED`.
- **Founder/moderation**: `founder.ts/.functions.ts`, `roles.ts`, `moderation.functions.ts`, `/_authenticated/fondateur.tsx`, `/_authenticated/moderation.tsx`, `components/founder/*`.

## 3. Confirmed current baseline (preserve, never regress)

Premium design system; anime/film/series catalogues + search + filters; infinite scroll + load-more; caching; scroll restoration; back-to-top; rich internal fiches; AniList + TMDB + browser-direct fallback with bounded retry/timeout; enrichment layer; universe/franchise routes; characters/staff; episode + next-episode; article relevance; Découverte/Pour vous; shared playlists + likes + privacy; reviews/replies; media requests; roles + Founder Console + moderation; imports (MAL/Nautiljon/JSON/CSV/AniList) with preview/confirm/rollback/history; tracking fields; JSON/CSV export; notification center + security/RLS; email preferences + digests preview + encrypted unsub tokens + delivery logs; email stays **READY BUT UNCONFIGURED**.

## 4. Gaps / uncertainties (to verify at each phase entry, not assume)

- A1 exists but A2 reconciliation reliability, dedup/expiry pagination, and wording accuracy need a focused audit.
- `new_episode` and `personalized_recommendation` notifications deferred — reliability of an episode air-date source still unconfirmed.
- Shared-list **request** events (A3/D1/D2) depend on whether an invitation/request table exists for playlists (only `media_requests` seen — likely media requests, not list-collaboration invites).
- `/actualites` index route not present as a standalone file (only `actualites.$slug.tsx`) — B1 likely needs a new index route.
- `/communaute` and forum tables do not exist — Phase H is greenfield (additive).
- Chat: no infra — Phase I greenfield, last.

## 5. Complete ordered roadmap

Order preserved as specified; only intra-phase sequencing tuned by dependency. Each subphase below is compressed to the 17 required fields.

### PHASE A — Internal Notification Center
- **A1 Foundation** *(DONE — audit only)*. Objective: verify persisted notifications, badge, panel, `/notifications`, read/dismiss, prefs. Value: reliable in-app signals. Deps: none. Reuse: existing notif stack. Files: `notifications.*`, `use-notifications.tsx`, `components/notifications/*`. Schema: none. RLS: confirm read-only member, server-only writes. UI: bell + page + prefs. Providers: none. Perf: single per-session reconcile. Regression: badge counts. QA: unread accuracy, dismiss idempotency, RLS forge test. PASS: no forgeable writes, correct counts. Stop: any cross-user read. Autonomous: yes. Approval: no. **XS**.
- **A2 Quality & Reconciliation**. Objective: stable `event_key`, dedup, expiry, pagination, partial-provider tolerance, accurate episode/release wording, deterministic reco reasons, diagnostics. Value: trustworthy feed. Deps: A1. Reuse: `reconcileMyNotifications`. Files: `notifications.ts/.functions.ts`, `use-notifications.tsx`, notif route. Schema: possibly index on `(user_id,event_key)`/`expires_at` (additive). RLS: unchanged. UI: paginated list, empty/expired states. Providers: degrade gracefully. Perf: bounded query counts, indexed pagination. Regression: no duplicate events. QA: dedup under re-run, expiry hides, pagination stable. PASS: deterministic + no dupes. Stop: destructive index. Autonomous: yes. Approval: no. **M**.
- **A3 Community/Request notifications**. Objective: shared-list request received/accepted/declined; only reliable events. Value: actionable collaboration. Deps: A2, D1 request model (may reorder: needs a list-request table → defer emission until D1 lands the source). Reuse: notif pipeline. Files: `notifications.*`, playlist libs. Schema: consumes D1 request table. RLS: recipients only. UI: request notif cards + actions. Providers: none. Perf: low. Regression: no like/comment spam. QA: only meaningful events, no noise. PASS: no activity-feed spam. Stop: cross-user leakage. Autonomous: yes (after D1 source). Approval: no. **S**.
- **A4 Internal weekly digest**. Objective: in-app weekly recap from real notif+digest data, read state, quiet cadence, no email, no dupe with feed. Value: low-noise summary. Deps: A2, existing `digest.ts`. Reuse: `digest.ts`, `use-digest.tsx`. Files: new `/_authenticated` recap surface, `digest.ts`. Schema: optional `weekly_recap_reads` (additive) or reuse prefs. RLS: owner-of-row. UI: recap card/panel. Providers: none. Perf: computed, cached. Regression: no email trigger. QA: no duplication with notif feed, read state persists. PASS: in-app only, deterministic. Stop: any send path. Autonomous: yes. Approval: no. **M**.
- **A5 Preferences Phase 2**. Objective: granular controls, frequency/snooze, quiet mode, separate from email consent, no dark patterns. Value: user control. Deps: A2/A4. Reuse: `member_notification_preferences`. Files: `NotificationPreferences`, prefs functions. Schema: additive columns (snooze_until, quiet_mode). RLS: owner-only. UI: prefs section. Providers: none. Perf: trivial. Regression: email consent untouched. QA: snooze suppresses, quiet mode respected. PASS: consent isolation intact. Stop: consent coupling. Autonomous: yes. Approval: no. **S**.

### PHASE B — Editorial & Discovery
- **B1 Actualités index**. Objective: premium `/actualites` index, real articles only, categories, newest-first, search/filter if justified, empty states. Value: editorial hub. Deps: `news.ts`. Reuse: `news.ts`, `actualites.$slug.tsx`, design system. Files: new `src/routes/actualites.tsx`, article components. Schema: none (articles are code/data today) unless articles move to DB (then additive table + GRANT + RLS). UI: index route with own `head()`. Providers: none. Perf: static/cached. Regression: slug route intact. QA: newest-first, no fabricated content, empty state. PASS: real content only. Stop: fabricated data. Autonomous: yes. Approval: no. **S**.
- **B2 Relevance quality**. Objective: exact-title/franchise/related tiering, recency within tier, no generic unrelated article, links in media + notif surfaces. Value: precise discovery. Deps: B1. Reuse: `getRelevantArticlesForTitle`. Files: `news.ts`, media fiche, `RecentArticles.tsx`, notif builder. Schema: none. UI: article rails on fiche + notif. Perf: memoized matching. Regression: existing relevance. QA: no false matches, correct tiering. PASS: zero generic mismatches. Stop: n/a. Autonomous: yes. Approval: no. **S**.
- **B3 Editorial founder tools**. Objective: bounded article management, draft/published state, preview, metadata validation, Owner-only. Value: safe editorial control. Deps: B1; needs DB-backed articles. Reuse: founder console. Files: `fondateur.tsx`, founder functions, `news.ts`. Schema: `articles` table (additive) + GRANT + RLS if not present. RLS: Owner write, public read published. UI: founder editorial tab. Perf: low. Regression: existing article rendering. QA: draft hidden publicly, validation blocks bad meta. PASS: no fake generation, Owner-gated. Stop: content migration risk. Autonomous: yes (additive table). Approval: no. **M**.

### PHASE C — Enrichment & Data Quality
- **C1 Enrichment editor v2**. Objective: dedicated JSON-extras UI, structured fields where justified, validation, preview before publish, audit, no private notes in public RPC. Value: faster curation. Deps: existing enrichment. Reuse: `enrichment.ts/.functions.ts`, `media_enrichments`. Files: founder enrichment tab, enrichment functions. Schema: additive columns only if justified. RLS: Owner/mod write, public read of public fields only. UI: structured editor + preview. Perf: low. Regression: current overrides applied. QA: private fields never in public read, preview matches publish. PASS: no private leakage. Stop: schema removal. Autonomous: yes. Approval: no. **M**.
- **C2 Data quality dashboard**. Objective: surface missing synopsis/weak images/missing platform links/incomplete credits/broken routes/provider confidence; prioritize not mass-edit. Value: targeted fixes. Deps: C1. Reuse: enrichment + media queries. Files: new founder dashboard component. Schema: none (read-only aggregation) or additive `data_quality_snapshots`. RLS: Owner-only read. UI: founder diagnostics. Perf: aggregate queries bounded/cached. Regression: none. QA: no mass mutation, Owner-only. PASS: read-only, no member surveillance. Stop: bulk write. Autonomous: yes. Approval: no. **M**.
- **C3 Complementary provider research** *(research/plan output only)*. Objective: evaluate Jikan/Kitsu, confidence scoring, no scraping/blending/replacement. Value: coverage. Deps: stable AniList/TMDB. Reuse: fallback pattern. Files: research doc + optional adapter stub. Schema: none. Providers: additive, confidence-gated. Perf: n/a. Regression: none. QA: reliable-existing-data untouched. PASS: no uncontrolled blending. Stop: replacing reliable data. Autonomous: research yes; integration requires approval. Approval: yes for integration. **M**.

### PHASE D — Lists, Sharing & Member Experience
- **D1 Shared Lists v2**. Objective: refine requests, permissions, ownership, collaboration rules, privacy; audit before adding collaboration. Value: safe sharing. Deps: playlists baseline. Reuse: `playlists.ts`, `playlist_items`, `playlist_likes`. Files: playlist libs/routes. Schema: additive `playlist_requests`/`playlist_collaborators` + GRANT + RLS. RLS: owner + accepted collaborators only; privacy preserved. UI: request/permission controls. Perf: low. Regression: privacy behavior. QA: no private leakage, permission enforcement, cross-user isolation. PASS: RLS proven. Stop: cross-user data risk. Autonomous: yes. Approval: no. **L**.
- **D2 Member requests**. Objective: structured requests for shared lists/editorial suggestions, clear statuses, Founder triage, no public leakage. Value: channeled feedback. Deps: D1, `media_requests`. Reuse: `media-requests.ts`. Files: requests libs, founder triage. Schema: additive statuses/table. RLS: requester + Owner. UI: request form + triage. Perf: low. Regression: existing media requests. QA: statuses correct, no leakage. PASS: scoped visibility. Stop: public exposure. Autonomous: yes. Approval: no. **M**.
- **D3 Personal tracking UX**. Objective: progress editor, started/completed dates, rewatch, notes/tags usability; preserve tracking + import/export round-trip. Value: better tracking. Deps: tracking fields. Reuse: `use-list.tsx`, `list.functions.ts`. Files: list item editor components. Schema: none (fields exist). RLS: owner-only. UI: inline editors on lists/fiche. Perf: optimistic updates. Regression: export/import round-trip. QA: round-trip lossless, no data loss. PASS: round-trip verified. Stop: field removal. Autonomous: yes. Approval: no. **M**.
- **D4 Profile & library polish**. Objective: focused improvements, clearer stats, useful summaries, no redesign, no invasive tracking. Value: clarity. Deps: D3. Reuse: `profil.tsx`, `mes-listes.tsx`. Files: profile/library components. Schema: none. RLS: owner-only. UI: stats summaries. Perf: computed client/server bounded. Regression: existing profile. QA: no behavioral tracking. PASS: focused, non-invasive. Stop: full redesign. Autonomous: yes. Approval: no. **S**.

### PHASE E — Recommendation System
- **E1 "Pour vous" v2**. Objective: weight ratings/favorites/status/genres/tags/related, avoid completed-title spam, clear reasons. Value: relevance. Deps: tracking + reviews. Reuse: `recommend.ts`, `use-recommendations.tsx`, `pour-vous.tsx`. Files: recommend libs/route. Schema: none. RLS: owner-derived. UI: reasons on cards. Perf: bounded compute, cached. Regression: existing reco. QA: no completed spam, deterministic reasons. PASS: reasons explainable. Stop: n/a. Autonomous: yes. Approval: no. **L**.
- **E2 Reco feedback**. Objective: not-interested/already-seen/hide, persist safely, improve results, no compulsive patterns. Value: control. Deps: E1. Reuse: recommend libs. Files: reco components, functions. Schema: additive `recommendation_feedback` + GRANT + RLS. RLS: owner-only. UI: hide/feedback actions. Perf: low. Regression: reco output. QA: hidden persists, RLS scoped. PASS: owner isolation. Stop: cross-user. Autonomous: yes. Approval: no. **M**.
- **E3 Reco diagnostics**. Objective: Owner-only aggregate quality, no surveillance, no private-note/per-member inspection. Value: tuning. Deps: E2. Reuse: founder console. Files: founder diagnostics. Schema: none/aggregate. RLS: Owner-only. UI: founder tab. Perf: aggregate cached. Regression: none. QA: no per-member data. PASS: aggregate-only. Stop: member surveillance. Autonomous: yes. Approval: no. **S**.

### PHASE F — Founder Console Phase 2
- **F1 Operational health**. Objective: safe counts, provider status, failed reconciliations, enrichment gaps, import failures, notif health; no member-content surveillance. Deps: A2/C2. Reuse: founder functions. Files: founder dashboard. Schema: none/aggregate. RLS: Owner-only. UI: health panel. Perf: cached aggregates. QA: no private content. PASS: aggregate-only. Stop: surveillance. Autonomous: yes. Approval: no. **M**.
- **F2 Moderation improvements**. Objective: preserve Owner authority, clearer queues, audit trail, bounded actions, confirm destructive. Deps: moderation baseline. Reuse: `moderation.functions.ts`, `moderation_actions`, `content_reports`. Files: moderation route/components. Schema: additive audit columns. RLS: mod/Owner. UI: queues + confirmations. Perf: paginated. QA: destructive gated, audit recorded. PASS: confirmations enforced. Stop: unconfirmed destructive. Autonomous: yes. Approval: no. **M**.
- **F3 Product diagnostics**. Objective: broken-route detection, empty-state checks, provider degradation, data-quality overview, no secret exposure. Deps: F1/C2. Reuse: diagnostics. Files: founder diagnostics. Schema: none. RLS: Owner-only. UI: diagnostics panel. Perf: bounded. QA: no secrets in output. PASS: no secret exposure. Stop: secret leak. Autonomous: yes. Approval: no. **S**.

### PHASE G — Email Future Readiness — **HUMAN APPROVAL REQUIRED (all)**
- **G1 Custom domain readiness**: plan DNS/verified subdomain; external manual action. STOP before implementation. Autonomous: **no**. **M**.
- **G2 Founder-only real test**: requires verified domain+secrets; Owner-only; STOP before real send. Autonomous: **no**. **S**.
- **G3 Delivery simulation**: eligible-recipient counts, no send, consent-safe dry run. Autonomous build of the *simulation* allowed only if it sends nothing; emission requires approval. **S**.
- **G4 Small opt-in pilot**: real sends only after explicit human approval. Autonomous: **no**. **M**.
- **G5 Scheduled digests**: only after pilot; approval + monitoring + unsubscribe/reputation checks. Autonomous: **no**. **L**.
Email must remain **READY BUT UNCONFIGURED** until a human completes G1/G2.

### PHASE H — Community Foundation — **APPROVAL before H2 build**
- **H1 Community structure**: `/communaute` separate from `/listes` and `/actualites`; topic/category structure; premium readable; no Discord clone, no noisy global feed. Schema: additive `forum_categories`. RLS: public read, Owner write categories. Autonomous: structure yes. **M**.
- **H2 Forum Phase 1**: topics/posts/replies, edit/delete ownership, moderation, reports, pagination, RLS, rate limits, no chat. Schema: additive `forum_topics`, `forum_posts`, `forum_reports` (+GRANT+RLS). RLS: author edit/delete, mod/Owner moderate, public read. Perf: paginated. QA: cross-user isolation, rate limits, no fake content. Autonomous: **requires approval** (large new surface). **XL**.
- **H3 Forum quality**: search, categories, pinned/locked, moderation history, spam prevention, empty states, mobile polish. Deps: H2. Autonomous: yes after H2. **L**.
- **H4 Community notifications**: meaningful reply/mention/moderation only; prefs; dedup; no like spam. Deps: H2 + A2. Autonomous: yes. **M**.

### PHASE I — Chat (LAST) — **APPROVAL REQUIRED**
- **I1 Feasibility/safety plan**: audit justification, architecture, moderation, abuse prevention, privacy, blocking, reporting, rate limits, retention. Output: plan only. Autonomous: plan yes, build no. **M**.
- **I2 Limited chat**: only if all prior stable; no uncontrolled public global chat; narrow scope; human approval before build. Autonomous: **no**. **XL**.
- **I3 Chat expansion**: only after explicit review. Autonomous: **no**. **L**.

### PHASE J — Final Stabilization (verification-only)
- **J1 Full regression** (desktop/mobile/auth/anon/Owner/member/provider failure/empty/large lists/notif+forum volume). Autonomous: yes. **L**.
- **J2 Accessibility/UX** (keyboard, focus, labels, contrast, reduced motion, responsive; focused polish). Autonomous: yes. **M**.
- **J3 Performance** (bundle, query counts, route loading, caching, memory, provider calls, no needless refetch). Autonomous: yes. **M**.
- **J4 Security review** (RLS, auth, Owner gates, server/client boundaries, tokens, rate limits, cross-user isolation, secrets, logs). Autonomous: yes. **M**.
- **J5 Production readiness report** (do not publish; list manual actions/migrations/secrets/external deps; per-feature status; manual publish checklist). Autonomous: yes. **S**.

## 6. Safe autonomous batches

- **Batch 1 — Notifications quality**: A2, A5. Outcome: reliable, paginated, controllable feed. Checkpoint: typecheck + dedup/expiry/RLS QA. Continue if PASS.
- **Batch 2 — Internal digest**: A4. Outcome: in-app weekly recap, no email. Checkpoint: no-send + no-dupe QA. Continue if PASS.
- **Batch 3 — Editorial**: B1, B2 (B3 only if articles moved to DB). Outcome: premium `/actualites` + precise relevance. Checkpoint: no-fabrication + slug-route QA.
- **Batch 4 — Enrichment/data quality**: C1, C2. Outcome: curation editor + quality dashboard. Checkpoint: private-field-leak + read-only QA.
- **Batch 5 — Lists & requests** ✅ DONE: D1 (playlist_collaborators + playlist_requests tables, is_playlist_collaborator/is_playlist_editor definer helpers, additive collaborator RLS on playlists/playlist_items), D2 (playlist-collab.ts hooks + CollabPanel + "Partagées avec moi" section), A3 emission (request_playlist_join / decide_playlist_request / notify_member definer RPCs, prefs + quiet_mode respected). Typecheck PASS. Cross-user isolation enforced via RLS + definer RPCs (owner-only decisions, private lists reject requests).
- **Batch 6 — Tracking & profile** ✅ DONE: D3 (ListPatch + getMyList extended with progress/started_at/completed_at/rewatch_count/is_rewatching; tracking editor in ListControls; progress + rewatch badges on library cards) + D4 (richer non-invasive profile insights: à voir, épisodes suivis, revisionnages, note moyenne). Export/import round-trip already maps these fields — unchanged. Typecheck PASS. No schema change (fields already existed).
- **Batch 7 — Recommendations** ✅ DONE: E1 (rankForYou already excludes saved/completed titles → no completed-spam; reason genres available) + E2 (additive `recommendation_feedback` table with owner-only RLS; `recommend.functions.ts` add/remove/get + `useRecoFeedback` hook with optimistic updates; per-card "pas intéressé" dismiss on ForYou rails + "Tout réafficher" restore chip; dismissed titles filtered from ranking pool) + E3 (owner/moderator-only `reco_feedback_stats` security-definer RPC surfaced as aggregate-only `RecoFeedbackSection` in Founder → Qualité tab). Typecheck PASS.
- **Batch 8 — Founder console v2**: F1, F2, F3. Outcome: operational + moderation + diagnostics. Checkpoint: no-secret/no-surveillance QA.
- **Batch 9 — Regression/security (Phase J partial)**: J1, J4 run as a mid-roadmap gate before touching community.
- **Batches G / H / I**: each opens with a STOP for human approval; do not auto-start.
- **Batch Final**: J2, J3, J5 after community stabilizes.

Continuation rule for every batch: proceed to the next only on PASS + clean typecheck + additive migrations + RLS validated + no regression + no manual/external action + no open product decision.

## 7. Dependency graph (text)

```
A1(done) → A2 → A5
              → A4
D1 → D2 → A3(emission)
B1 → B2 → B3(needs DB articles)
C1 → C2 → C3(approval to integrate)
D3 → D4
E1 → E2 → E3
A2,C2 → F1 ; moderation → F2 ; F1,C2 → F3
J1,J4 gate → (H1 → H2[approval] → H3, H4[needs A2]) 
H stable → I1 → I2[approval] → I3[approval]
G1[human] → G2[human] → G3 → G4[human] → G5[human]  (parallel track, gated)
all → J1,J2,J3,J4,J5
```

## 8. Database migration plan (all additive; each with GRANT + RLS in same migration)

- A2: indexes on `member_notifications(user_id,event_key)`, `(expires_at)`.
- A4: optional `weekly_recap_reads(user_id, week_start, read_at)`.
- A5: add `snooze_until`, `quiet_mode` to `member_notification_preferences`.
- B3: `articles(id, slug, title, body, category, status, published_at, ...)` if editorial moves to DB.
- C1: optional structured columns on `media_enrichments`.
- D1: `playlist_requests` and/or `playlist_collaborators(playlist_id, user_id, role, status)`.
- D2: request statuses/table extensions.
- E2: `recommendation_feedback(user_id, media_ref, action, created_at)`.
- F2: audit columns on `moderation_actions`.
- H1/H2: `forum_categories`, `forum_topics`, `forum_posts`, `forum_reports`.
- I2: chat tables — only under approval.
No destructive DDL. Every new public table follows CREATE → GRANT → ENABLE RLS → POLICY.

## 9. RLS / security plan

- Members read only their own notifications/prefs/feedback/tracking; all notification writes stay server/`service_role`-controlled (no client forgery).
- Playlist collaboration scoped to owner + accepted collaborators; privacy preserved; cross-user isolation is the hard gate for D1.
- Editorial/enrichment/diagnostics writes Owner/mod via `has_role`; public reads expose published/public fields only — never private notes.
- Forum: author-scoped edit/delete, mod/Owner moderation, public read; reports scoped to reporter + moderators; rate limits enforced server-side.
- No secrets client-side; Founder diagnostics never emit secrets or per-member private content.

## 10. Provider resilience plan

Keep bounded retry + timeout + browser-direct AniList fallback; reconciliation and diagnostics degrade to `skipped/partial` on provider failure (no infinite spinners, no silent retry loops). C3 additional providers are confidence-scored and additive only — never replace reliable AniList/TMDB data; no scraping.

## 11. Regression strategy

Each batch ends with: typecheck, targeted unit tests (digest/import/export/notifications), and Playwright authenticated + anonymous smoke of affected routes. Global invariants verified every phase: no infinite loading, no false "introuvable", no lost filters/scroll, no broken routes, no duplicate events, no fake content, no cross-user access, no client secret, no misleading success, no auto-publish.

## 12. Human-approval gates

G1, G2, G4, G5 (any real send / domain / secret / scheduling); C3 provider integration; H2 forum build; I2/I3 chat build; any destructive migration or publish.

## 13. Stop conditions

PARTIAL/BLOCKED verdict; destructive migration; security/RLS uncertainty; cross-user data risk; unresolved regression; external provider activation; domain/secret config; real email send; scheduling/background production jobs; publishing; irreversible data op; major redesign; unclear product decision.

## 14. Build-mode execution instructions

Execute one batch at a time in listed order. Per batch: (1) audit existing implementation, (2) make smallest additive change, (3) migrations additive with GRANT+RLS via the migration tool (stop for approval before running destructive ones), (4) typecheck, (5) regression + RLS QA, (6) emit an explicit checkpoint with PASS/PARTIAL/BLOCKED verdict. Continue automatically only on PASS with all continuation conditions met; otherwise STOP and report. Never auto-enter G/H2/I batches.

## 15. Final expected end state

A premium anime-first French app with a reliable internal notification center + weekly recap, precise editorial discovery, a curation/data-quality toolset, safe collaborative lists + member requests, a stronger explainable recommendation system, a Founder Console v2 for operations/moderation/diagnostics, a moderated forum community, an email system still READY-BUT-UNCONFIGURED until a human completes domain verification, and chat scoped as the final gated feature — with all previously validated features preserved.

## 16. Deliberately excluded

Real-time WebSockets/push before chat; public global unmoderated chat; noisy social activity feed / like-comment spam; Discord clone; fabricated content; scraping; uncontrolled provider blending; automatic email sends/scheduling without domain + human approval; full redesigns of validated areas; behavioral surveillance of members.

## 17. Authorization sentence to start Build mode

> "Execute the KAZEN Master Roadmap in Build mode starting with Batch 1 (Phase A2 + A5), proceed autonomously batch by batch on PASS verdicts, and STOP for my approval at any human-approval gate (email G-phases, forum H2, chat I2/I3, or any destructive migration)."
