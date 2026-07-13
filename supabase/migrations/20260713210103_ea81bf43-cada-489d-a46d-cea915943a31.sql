-- Table
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
GRANT SELECT ON public.shared_playlist_reviews TO anon;
GRANT ALL ON public.shared_playlist_reviews TO service_role;

CREATE INDEX idx_spr_playlist_created ON public.shared_playlist_reviews (playlist_id, created_at DESC);
CREATE INDEX idx_spr_author ON public.shared_playlist_reviews (author_id);
CREATE INDEX idx_spr_moderation ON public.shared_playlist_reviews (hidden_at, deleted_at);

CREATE TRIGGER trg_spr_updated_at BEFORE UPDATE ON public.shared_playlist_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shared_playlist_reviews ENABLE ROW LEVEL SECURITY;

-- Visibility helper
CREATE OR REPLACE FUNCTION public.can_view_playlist(_playlist uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.playlists p
    WHERE p.id = _playlist AND p.hidden_at IS NULL AND p.deleted_at IS NULL
      AND (p.is_public OR p.owner_id = _user))
  OR public.is_moderator(_user);
$$;

-- Read policy (writes go exclusively through the RPCs below)
CREATE POLICY "Read reviews on viewable playlists"
ON public.shared_playlist_reviews FOR SELECT TO public
USING (
  (hidden_at IS NULL AND deleted_at IS NULL AND public.can_view_playlist(playlist_id, auth.uid()))
  OR auth.uid() = author_id
  OR public.is_moderator(auth.uid())
);

-- Create / edit (upsert, self only, eligibility + rate limit)
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

-- Extend submit_content_report to accept 'playlist_review'
CREATE OR REPLACE FUNCTION public.submit_content_report(_target_type moderation_target_type, _target_id uuid, _reason text, _details text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  reporter uuid := auth.uid();
  new_id uuid;
  target_exists boolean;
BEGIN
  IF reporter IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF _reason IS NULL OR char_length(trim(_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required.';
  END IF;

  target_exists := CASE _target_type
    WHEN 'review' THEN EXISTS (SELECT 1 FROM public.fiche_reviews WHERE id = _target_id)
    WHEN 'reply' THEN EXISTS (SELECT 1 FROM public.review_replies WHERE id = _target_id)
    WHEN 'playlist' THEN EXISTS (SELECT 1 FROM public.playlists WHERE id = _target_id)
    WHEN 'playlist_item' THEN EXISTS (SELECT 1 FROM public.playlist_items WHERE id = _target_id)
    WHEN 'playlist_review' THEN EXISTS (SELECT 1 FROM public.shared_playlist_reviews WHERE id = _target_id)
    ELSE false
  END;
  IF NOT target_exists THEN
    RAISE EXCEPTION 'Target content does not exist.';
  END IF;

  INSERT INTO public.content_reports (target_type, target_id, reporter_id, reason, details)
  VALUES (_target_type, _target_id, reporter, left(_reason, 200), left(COALESCE(_details,''), 2000))
  ON CONFLICT (reporter_id, target_type, target_id) WHERE status IN ('pending','reviewing')
  DO UPDATE SET reason = EXCLUDED.reason, details = EXCLUDED.details, updated_at = now()
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

-- Extend moderate_content to handle 'playlist_review'
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
  IF NOT public.can_moderate_now(actor) THEN
    RAISE EXCEPTION 'Insufficient privileges to moderate content.';
  END IF;

  IF _action IN ('lock','unlock','warn','timeout') THEN
    RAISE EXCEPTION 'Action % is not supported yet.', _action;
  END IF;

  target_exists := CASE _target_type
    WHEN 'review' THEN EXISTS (SELECT 1 FROM public.fiche_reviews WHERE id = _target_id)
    WHEN 'reply' THEN EXISTS (SELECT 1 FROM public.review_replies WHERE id = _target_id)
    WHEN 'playlist' THEN EXISTS (SELECT 1 FROM public.playlists WHERE id = _target_id)
    WHEN 'playlist_item' THEN EXISTS (SELECT 1 FROM public.playlist_items WHERE id = _target_id)
    WHEN 'playlist_review' THEN EXISTS (SELECT 1 FROM public.shared_playlist_reviews WHERE id = _target_id)
    ELSE false
  END;
  IF NOT target_exists THEN
    RAISE EXCEPTION 'Target content does not exist.';
  END IF;

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
    ELSIF _target_type = 'playlist_review' THEN
      UPDATE public.shared_playlist_reviews SET
        hidden_at  = CASE WHEN _action='hide' THEN now() WHEN _action='unhide' THEN NULL ELSE hidden_at END,
        hidden_by  = CASE WHEN _action='hide' THEN actor WHEN _action='unhide' THEN NULL ELSE hidden_by END,
        deleted_at = CASE WHEN _action='soft_delete' THEN now() WHEN _action='restore' THEN NULL ELSE deleted_at END,
        deleted_by = CASE WHEN _action='soft_delete' THEN actor WHEN _action='restore' THEN NULL ELSE deleted_by END
      WHERE id = _target_id;
    END IF;
  END IF;

  INSERT INTO public.moderation_actions (actor_id, target_type, target_id, action, reason, note, report_id)
  VALUES (actor, _target_type, _target_id, _action, COALESCE(_reason,''), COALESCE(_note,''), _report_id);

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