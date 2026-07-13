# Phase 10 — Member Reviews on Shared Playlists

**Verdict: READY FOR APPROVAL** (frontend + one additive migration). Nothing has been applied. Explicit approval **is required** before the migration runs; schema-dependent UI will only be built after approval.

## 1. Audit findings (existing foundations to reuse)

- **Shared playlists** (`playlists`): visibility = `is_public`, plus `hidden_at`/`deleted_at` soft-state. RLS `Visible public playlists are readable` = `(is_public OR owner) AND not hidden/deleted OR owner OR moderator`. Collaborators via `playlist_collaborators` (viewer/editor). Detail read by `usePlaylist` (browser client, RLS-gated) exposing `meta.isPublic`, `meta.ownerId`.
- **Media reviews** (`fiche_reviews`): keyed by `media_source`+`media_external_id`, `body` 1–4000, `rating` smallint 0–10, soft-delete via `hidden_at`/`deleted_at`, one-per-user upsert. Written directly through the browser client under RLS. Profiles are batch-joined (`.in('id', ids)`) — no N+1.
- **Reporting**: `content_reports` + `submit_content_report` RPC (dedup via partial unique on open reports, reporter derived from `auth.uid()`), enum `moderation_target_type = {review, reply, playlist, playlist_item}`. UI `ReportDialog` already reused on playlists.
- **Moderation spine**: `moderate_content` RPC (hide/unhide/soft_delete/restore + audit into `moderation_actions`), `moderationQueue` server fn with `loadTargetSnapshot`, `/moderation` console with `TARGET_LABELS`. `can_moderate_now` currently = owner only.
- **Notifications**: `notify_member` RPC (respects `shared_list_enabled`/`quiet_mode`, deduped by `event_key`).

**Conclusion:** `fiche_reviews` cannot be safely reused — it is hard-bound to media source/external id and its RLS/CHECK constraints. A **dedicated `shared_playlist_reviews` table** is safer and avoids mixing media and playlist reviews. The report + moderation + notification spines **are reused** by adding one enum value and extending the existing RPCs/snapshot.

## 2. Schema recommendation

Dedicated table `shared_playlist_reviews`. **Deviation from the brief:** use `hidden_at/hidden_by/deleted_at/deleted_by` (as in `fiche_reviews`) instead of a `moderation_status text` column, so `moderate_content` works unchanged — a safer reuse of the existing spine than inventing a parallel status vocabulary.

## 3. One-review-per-user decision

**Recommended: one review per author per playlist** (`UNIQUE (playlist_id, author_id)`), edited via upsert. Matches `fiche_reviews` "avis" semantics and keeps the list clean, countable and paginable. **Tradeoff:** members cannot post multiple takes over time; re-reviewing overwrites and stamps `edited_at`. This mirrors existing product behaviour and is the least surprising. (Multiple reviews would need spam controls and threading we do not want in Phase 10.)

## 4. Eligibility rules

Create/edit allowed only when: authenticated; playlist `is_public`; not `hidden_at`/`deleted_at`; caller may view it. Owner **may** review their own public playlist (allowed, low-risk; can be forbidden on request). Private personal "Ma liste" is never affected (different feature). **Playlist goes private → reviews are preserved but hidden from public** automatically, because the SELECT policy is derived from live playlist visibility (no delete, no data loss). If it becomes public again they reappear.

## 5. Content model

Written `body` required, plain text only, 1–4000 chars (trimmed, control chars stripped, **no raw HTML** — rendered as text, never `dangerouslySetInnerHTML`). Optional `rating` smallint 0–10 (matches fiche convention). Links shown as plain text, not auto-linked in Phase 10. Only `edited_at` timestamp (no full edit history). **Soft delete** (`deleted_at`), never hard delete, to preserve moderation audit.

## 6. Exact proposed migration (additive, non-destructive — NOT applied)

```sql
-- Enum: reuse the moderation spine for a new target type
ALTER TYPE public.moderation_target_type ADD VALUE IF NOT EXISTS 'playlist_review';

CREATE TABLE public.shared_playlist_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  rating smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_at  timestamptz,
  hidden_at  timestamptz, hidden_by uuid,
  deleted_at timestamptz, deleted_by uuid,
  CONSTRAINT spr_body_len CHECK (char_length(body) BETWEEN 1 AND 4000),
  CONSTRAINT spr_rating_range CHECK (rating IS NULL OR (rating BETWEEN 0 AND 10)),
  CONSTRAINT spr_one_per_author UNIQUE (playlist_id, author_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_playlist_reviews TO authenticated;
GRANT SELECT ON public.shared_playlist_reviews TO anon;   -- public playlists are anon-readable
GRANT ALL ON public.shared_playlist_reviews TO service_role;

CREATE INDEX idx_spr_playlist_created ON public.shared_playlist_reviews (playlist_id, created_at DESC);
CREATE INDEX idx_spr_author ON public.shared_playlist_reviews (author_id);
CREATE INDEX idx_spr_moderation ON public.shared_playlist_reviews (hidden_at, deleted_at);

CREATE TRIGGER trg_spr_updated_at BEFORE UPDATE ON public.shared_playlist_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shared_playlist_reviews ENABLE ROW LEVEL SECURITY;

-- Visibility helper (security definer avoids recursion / cross-table RLS cost)
CREATE OR REPLACE FUNCTION public.can_view_playlist(_playlist uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.playlists p
    WHERE p.id = _playlist AND p.hidden_at IS NULL AND p.deleted_at IS NULL
      AND (p.is_public OR p.owner_id = _user))
  OR public.is_moderator(_user);
$$;

-- Read policy only; ALL writes go through SECURITY DEFINER RPCs (no user write policies)
CREATE POLICY "Read reviews on viewable playlists"
ON public.shared_playlist_reviews FOR SELECT TO public
USING (
  (hidden_at IS NULL AND deleted_at IS NULL AND public.can_view_playlist(playlist_id, auth.uid()))
  OR auth.uid() = author_id
  OR public.is_moderator(auth.uid())
);

-- Create/edit (upsert, self only, eligibility enforced server-side, rate-limited)
CREATE OR REPLACE FUNCTION public.upsert_playlist_review(_playlist uuid, _body text, _rating smallint DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); is_pub boolean; ownr uuid; b text := trim(coalesce(_body,'')); rid uuid; recent int;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT is_public, owner_id INTO is_pub, ownr FROM public.playlists
    WHERE id=_playlist AND hidden_at IS NULL AND deleted_at IS NULL;
  IF ownr IS NULL THEN RAISE EXCEPTION 'Playlist introuvable.'; END IF;
  IF NOT is_pub THEN RAISE EXCEPTION 'Cette liste n''accepte pas d''avis.'; END IF;
  IF char_length(b) < 1 OR char_length(b) > 4000 THEN RAISE EXCEPTION 'Avis invalide.'; END IF;
  IF _rating IS NOT NULL AND (_rating < 0 OR _rating > 10) THEN RAISE EXCEPTION 'Note invalide.'; END IF;
  SELECT count(*) INTO recent FROM public.shared_playlist_reviews
    WHERE author_id=caller AND updated_at > now() - interval '2 minutes';
  IF recent >= 10 THEN RAISE EXCEPTION 'Trop d''avis récemment. Réessaie plus tard.'; END IF;
  INSERT INTO public.shared_playlist_reviews (playlist_id, author_id, body, rating)
  VALUES (_playlist, caller, b, _rating)
  ON CONFLICT (playlist_id, author_id) DO UPDATE
    SET body=excluded.body, rating=excluded.rating, edited_at=now(), updated_at=now(),
        deleted_at=NULL, deleted_by=NULL
  RETURNING id INTO rid;
  IF ownr <> caller THEN
    PERFORM public.notify_member(ownr, 'playlist_review',
      'plrev:'||_playlist::text||':'||caller::text,
      'Nouvel avis sur ta liste', left(b,140), '/playlist/'||_playlist::text);
  END IF;
  RETURN rid;
END; $$;

-- Soft delete (author or moderator)
CREATE OR REPLACE FUNCTION public.delete_playlist_review(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); a uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT author_id INTO a FROM public.shared_playlist_reviews WHERE id=_id AND deleted_at IS NULL;
  IF a IS NULL THEN RETURN; END IF;
  IF a <> caller AND NOT public.can_moderate_now(caller) THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  UPDATE public.shared_playlist_reviews SET deleted_at=now(), deleted_by=caller, updated_at=now() WHERE id=_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.upsert_playlist_review(uuid,text,smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_playlist_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_playlist(uuid,uuid) TO authenticated, anon;
```

Plus a small `ALTER FUNCTION public.moderate_content` / `submit_content_report` patch (same migration): add a `'playlist_review'` branch to each `target_exists` CASE, and a `hide/unhide/soft_delete/restore` UPDATE branch on `shared_playlist_reviews` inside `moderate_content` — mirroring the existing `review` branch exactly.

## 7. RLS + server-enforcement plan

Read: single SELECT policy above (anon + authenticated). **No user INSERT/UPDATE/DELETE policies** — every write is a SECURITY DEFINER RPC that derives the author from `auth.uid()`, so arbitrary `author_id`, cross-user edits, private-playlist writes and hidden-row enumeration are structurally impossible. Moderation stays owner-gated via `can_moderate_now`.

## 8. RPC / server-function plan

- DB RPCs: `upsert_playlist_review`, `delete_playlist_review` (above); moderation via existing `moderate_content`; reporting via existing `submit_content_report`.
- New `src/lib/playlist-reviews.functions.ts`: `upsertPlaylistReview`, `deletePlaylistReview` (`requireSupabaseAuth`, thin RPC wrappers — same shape as `moderation.functions.ts`).
- New `src/lib/playlist-reviews.ts`: `usePlaylistReviews(playlistId)` (browser client read, RLS-gated, batch profile join, page size 10 with load-more), `usePlaylistReviewCount`, `useMyPlaylistReview`, mutation hooks via `useServerFn`.

## 9. Moderation / reporting integration

Reuse `ReportDialog` with `targetType="playlist_review"`; add `'playlist_review'` to the `ModerationTargetType` union, to `loadTargetSnapshot` (preview from `body`, link `/playlist/{playlist_id}`, author public identity only), and to `TARGET_LABELS` ("Avis sur liste"). Queue, audit trail and safe actions come for free.

## 10. Notification decision

**Include one, minimal:** owner notified once per (playlist, author) on a new review via `notify_member` (respects prefs, deduped). No per-edit, no like, no public feed. Author moderation-result notifications are **deferred** as optional follow-up.

## 11. UI plan

New `src/components/playlist/PlaylistReviews.tsx`, mounted at the bottom of `playlist.$id.tsx` **only when `data.meta.isPublic`**: section title + count, compact form for eligible authenticated members (textarea + optional 0–10 rating), empty state, load-more paginated list (author avatar/name via existing `Avatar`, created date, "modifié" indicator, body as plain text, optional rating), edit/delete own, `ReportDialog` on others, moderator-state chip when hidden. Uses existing tokens only — **no DA change** (black + metallic-crimson preserved). Jacket grid, favorite/rating metadata, mobile and CollabPanel untouched.

## 12. Performance plan

Page size 10 + load-more; ordered by `(playlist_id, created_at DESC)` index; count via `head:true` count query; single batched profile fetch (no N+1); moderation index on `(hidden_at, deleted_at)`; no full-history load.

## 13. Rollback

`DROP TABLE public.shared_playlist_reviews CASCADE;` + `DROP FUNCTION upsert_playlist_review, delete_playlist_review, can_view_playlist;` + revert the `moderate_content`/`submit_content_report` branches. The added enum label `'playlist_review'` cannot be removed cleanly in Postgres but is inert once unreferenced — documented, harmless. Everything is additive; no existing table/policy/data is modified.

## 14. QA matrix (post-approval)

Anon views public playlist (reviews visible, no form) · anon review attempt (blocked) · member creates/edits/deletes own · owner reviews own public list · duplicate → upsert overwrite · edit another's (blocked) · private list (no section, no writes) · public→private (reviews hidden, preserved) → back to public (reappear) · report review → queue → moderator hide/remove/restore · pagination + empty state + 100+ reviews · mobile + dark · cross-user isolation · `tsgo` typecheck · regression on playlists, lists, forum, notifications, Founder Console, moderation queue.

## 15. Files expected to change (after approval)

New: migration; `src/lib/playlist-reviews.ts`; `src/lib/playlist-reviews.functions.ts`; `src/components/playlist/PlaylistReviews.tsx`.
Edited (minimal): `src/routes/playlist.$id.tsx` (mount section); `src/lib/moderation.functions.ts` (union + snapshot branch); `src/routes/_authenticated/moderation.tsx` (`TARGET_LABELS`). `ReportDialog` needs no change beyond the widened union type it imports.

## 16. Risks

Enum-value add is irreversible (mitigated: inert). Owner-review allowance is a product choice (easy to forbid). Visibility-derived read policy means private-toggle instantly hides reviews (intended). `ADD VALUE` to an enum must be committed before use in the same migration — will be split so the enum commit precedes the RPC patch.

## 17. Confirmation

Nothing was applied. No migration executed, no schema-dependent UI built. Awaiting explicit approval to proceed.
