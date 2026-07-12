-- ============================================================
-- Phase C.1 — Moderation Hardening
-- ============================================================

-- ---------- 1. Tighten grants (append-only audit, RPC-only writes) ----------
REVOKE ALL ON public.moderation_actions FROM anon, authenticated;
GRANT SELECT ON public.moderation_actions TO authenticated;
GRANT ALL ON public.moderation_actions TO service_role;

REVOKE ALL ON public.content_reports FROM anon, authenticated;
GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;

-- Reports: resolution must go through resolve_report / moderate_content (SECURITY DEFINER).
-- Remove direct moderator UPDATE that bypasses audit + resolved_by/at/note.
DROP POLICY IF EXISTS "Moderators can update report status" ON public.content_reports;

-- ---------- 2. fiche_reviews: owners cannot edit / delete / unhide moderated rows ----------
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.fiche_reviews;
CREATE POLICY "Users can update their own reviews"
ON public.fiche_reviews FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND hidden_at IS NULL AND deleted_at IS NULL)
WITH CHECK (
  auth.uid() = user_id AND hidden_at IS NULL AND deleted_at IS NULL
  AND (char_length(body) >= 1 AND char_length(body) <= 4000)
  AND (rating IS NULL OR (rating >= 0 AND rating <= 10))
);

DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.fiche_reviews;
CREATE POLICY "Users can delete their own reviews"
ON public.fiche_reviews FOR DELETE TO authenticated
USING (auth.uid() = user_id AND hidden_at IS NULL AND deleted_at IS NULL);

-- ---------- 3. review_replies ----------
DROP POLICY IF EXISTS "Users can update their replies" ON public.review_replies;
CREATE POLICY "Users can update their replies"
ON public.review_replies FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND hidden_at IS NULL AND deleted_at IS NULL)
WITH CHECK (auth.uid() = user_id AND hidden_at IS NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can delete their replies" ON public.review_replies;
CREATE POLICY "Users can delete their replies"
ON public.review_replies FOR DELETE TO authenticated
USING (auth.uid() = user_id AND hidden_at IS NULL AND deleted_at IS NULL);

-- ---------- 4. playlists ----------
DROP POLICY IF EXISTS "Users can update their playlists" ON public.playlists;
CREATE POLICY "Users can update their playlists"
ON public.playlists FOR UPDATE TO authenticated
USING (auth.uid() = owner_id AND hidden_at IS NULL AND deleted_at IS NULL)
WITH CHECK (auth.uid() = owner_id AND hidden_at IS NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can delete their playlists" ON public.playlists;
CREATE POLICY "Users can delete their playlists"
ON public.playlists FOR DELETE TO authenticated
USING (auth.uid() = owner_id AND hidden_at IS NULL AND deleted_at IS NULL);

-- ---------- 5. playlist_items: block writes inside moderated playlists / on moderated items ----------
DROP POLICY IF EXISTS "Owners can add playlist items" ON public.playlist_items;
CREATE POLICY "Owners can add playlist items"
ON public.playlist_items FOR INSERT TO authenticated
WITH CHECK (
  hidden_at IS NULL AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.playlists p
    WHERE p.id = playlist_items.playlist_id
      AND p.owner_id = auth.uid()
      AND p.hidden_at IS NULL AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "Owners can update playlist items" ON public.playlist_items;
CREATE POLICY "Owners can update playlist items"
ON public.playlist_items FOR UPDATE TO authenticated
USING (
  hidden_at IS NULL AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.playlists p
    WHERE p.id = playlist_items.playlist_id
      AND p.owner_id = auth.uid()
      AND p.hidden_at IS NULL AND p.deleted_at IS NULL
  )
)
WITH CHECK (
  hidden_at IS NULL AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.playlists p
    WHERE p.id = playlist_items.playlist_id
      AND p.owner_id = auth.uid()
      AND p.hidden_at IS NULL AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "Owners can delete playlist items" ON public.playlist_items;
CREATE POLICY "Owners can delete playlist items"
ON public.playlist_items FOR DELETE TO authenticated
USING (
  hidden_at IS NULL AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.playlists p
    WHERE p.id = playlist_items.playlist_id
      AND p.owner_id = auth.uid()
      AND p.hidden_at IS NULL AND p.deleted_at IS NULL
  )
);

-- ---------- 6. Harden moderate_content: reject no-op actions, validate target exists ----------
CREATE OR REPLACE FUNCTION public.moderate_content(_target_type moderation_target_type, _target_id uuid, _action moderation_action_type, _reason text DEFAULT ''::text, _note text DEFAULT ''::text, _report_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid := auth.uid();
  target_exists boolean;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF NOT public.is_moderator(actor) THEN
    RAISE EXCEPTION 'Insufficient privileges to moderate content.';
  END IF;

  -- Reject actions with no implemented state effect (future-friendly, but not usable yet)
  IF _action IN ('lock','unlock','warn','timeout') THEN
    RAISE EXCEPTION 'Action % is not supported yet.', _action;
  END IF;

  -- Validate target exists
  target_exists := CASE _target_type
    WHEN 'review' THEN EXISTS (SELECT 1 FROM public.fiche_reviews WHERE id = _target_id)
    WHEN 'reply' THEN EXISTS (SELECT 1 FROM public.review_replies WHERE id = _target_id)
    WHEN 'playlist' THEN EXISTS (SELECT 1 FROM public.playlists WHERE id = _target_id)
    WHEN 'playlist_item' THEN EXISTS (SELECT 1 FROM public.playlist_items WHERE id = _target_id)
    ELSE false
  END;
  IF NOT target_exists THEN
    RAISE EXCEPTION 'Target content does not exist.';
  END IF;

  -- Apply reversible state changes for content-affecting actions
  IF _action IN ('hide','unhide','soft_delete','restore') THEN
    IF _target_type = 'review' THEN
      UPDATE public.fiche_reviews SET
        hidden_at  = CASE WHEN _action='hide' THEN now() WHEN _action='unhide' THEN NULL ELSE hidden_at END,
        hidden_by  = CASE WHEN _action='hide' THEN actor WHEN _action='unhide' THEN NULL ELSE hidden_by END,
        deleted_at = CASE WHEN _action='soft_delete' THEN now() WHEN _action='restore' THEN NULL ELSE deleted_at END,
        deleted_by = CASE WHEN _action='soft_delete' THEN actor WHEN _action='restore' THEN NULL ELSE deleted_by END
      WHERE id = _target_id;
    ELSIF _target_type = 'reply' THEN
      UPDATE public.review_replies SET
        hidden_at  = CASE WHEN _action='hide' THEN now() WHEN _action='unhide' THEN NULL ELSE hidden_at END,
        hidden_by  = CASE WHEN _action='hide' THEN actor WHEN _action='unhide' THEN NULL ELSE hidden_by END,
        deleted_at = CASE WHEN _action='soft_delete' THEN now() WHEN _action='restore' THEN NULL ELSE deleted_at END,
        deleted_by = CASE WHEN _action='soft_delete' THEN actor WHEN _action='restore' THEN NULL ELSE deleted_by END
      WHERE id = _target_id;
    ELSIF _target_type = 'playlist' THEN
      UPDATE public.playlists SET
        hidden_at  = CASE WHEN _action='hide' THEN now() WHEN _action='unhide' THEN NULL ELSE hidden_at END,
        hidden_by  = CASE WHEN _action='hide' THEN actor WHEN _action='unhide' THEN NULL ELSE hidden_by END,
        deleted_at = CASE WHEN _action='soft_delete' THEN now() WHEN _action='restore' THEN NULL ELSE deleted_at END,
        deleted_by = CASE WHEN _action='soft_delete' THEN actor WHEN _action='restore' THEN NULL ELSE deleted_by END
      WHERE id = _target_id;
    ELSIF _target_type = 'playlist_item' THEN
      UPDATE public.playlist_items SET
        hidden_at  = CASE WHEN _action='hide' THEN now() WHEN _action='unhide' THEN NULL ELSE hidden_at END,
        hidden_by  = CASE WHEN _action='hide' THEN actor WHEN _action='unhide' THEN NULL ELSE hidden_by END,
        deleted_at = CASE WHEN _action='soft_delete' THEN now() WHEN _action='restore' THEN NULL ELSE deleted_at END,
        deleted_by = CASE WHEN _action='soft_delete' THEN actor WHEN _action='restore' THEN NULL ELSE deleted_by END
      WHERE id = _target_id;
    END IF;
  END IF;

  -- Append audit entry (actor always derived from auth.uid())
  INSERT INTO public.moderation_actions (actor_id, target_type, target_id, action, reason, note, report_id)
  VALUES (actor, _target_type, _target_id, _action, COALESCE(_reason,''), COALESCE(_note,''), _report_id);

  -- Optionally link/close a report
  IF _report_id IS NOT NULL THEN
    UPDATE public.content_reports
    SET status = CASE WHEN _action = 'dismiss_report' THEN 'dismissed' ELSE 'action_taken' END,
        resolved_by = actor,
        resolved_at = now(),
        resolution_note = COALESCE(_note,''),
        updated_at = now()
    WHERE id = _report_id;
  END IF;
END;
$function$;