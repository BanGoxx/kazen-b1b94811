-- 1) Beta gate: only the unique Owner may moderate right now.
--    Future switch: change the body to public.is_moderator(_user_id) to
--    re-enable moderator/admin access without touching call sites.
CREATE OR REPLACE FUNCTION public.can_moderate_now(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'owner');
$$;

REVOKE EXECUTE ON FUNCTION public.can_moderate_now(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_moderate_now(uuid) TO authenticated;

-- 2) Safe self-diagnostic: only reveals the caller's own access, nothing else.
CREATE OR REPLACE FUNCTION public.my_moderation_access()
RETURNS TABLE(is_owner boolean, can_moderate boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'owner') AS is_owner,
    public.can_moderate_now(auth.uid()) AS can_moderate;
$$;

REVOKE EXECUTE ON FUNCTION public.my_moderation_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_moderation_access() TO authenticated;

-- 3) Enforce beta Owner-only inside the privileged moderation RPCs.
CREATE OR REPLACE FUNCTION public.resolve_report(_report_id uuid, _status report_status, _note text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF NOT public.can_moderate_now(actor) THEN
    RAISE EXCEPTION 'Insufficient privileges to resolve reports.';
  END IF;

  UPDATE public.content_reports
  SET status = _status,
      resolved_by = CASE WHEN _status IN ('dismissed','action_taken') THEN actor ELSE resolved_by END,
      resolved_at = CASE WHEN _status IN ('dismissed','action_taken') THEN now() ELSE resolved_at END,
      resolution_note = COALESCE(_note,''),
      updated_at = now()
  WHERE id = _report_id;

  INSERT INTO public.moderation_actions (actor_id, target_type, target_id, action, reason, note, report_id)
  SELECT actor, target_type, target_id, 'dismiss_report', '', COALESCE(_note,''), id
  FROM public.content_reports WHERE id = _report_id AND _status = 'dismissed';
END;
$function$;

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

-- 4) Assign the unique Owner to reminder664@gmail.com and reconcile duplicates.
DO $$
DECLARE
  target_id uuid;
  stray record;
BEGIN
  SELECT id INTO target_id FROM auth.users WHERE lower(email) = lower('reminder664@gmail.com');

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'OWNER_ACCOUNT_NOT_FOUND: No auth user with email reminder664@gmail.com. Please sign up / log in with that account first, then re-run this step.';
  END IF;

  -- Ensure the target holds the owner role (idempotent).
  INSERT INTO public.user_roles (user_id, role, granted_by)
  VALUES (target_id, 'owner', target_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Remove any accidental duplicate owners (never the target).
  -- protect_owner_role blocks deleting owner rows, so bypass it just for
  -- this reconciliation, then restore the guard immediately.
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner' AND user_id <> target_id) THEN
    ALTER TABLE public.user_roles DISABLE TRIGGER USER;
    FOR stray IN SELECT user_id FROM public.user_roles WHERE role = 'owner' AND user_id <> target_id LOOP
      DELETE FROM public.user_roles WHERE role = 'owner' AND user_id = stray.user_id;
    END LOOP;
    ALTER TABLE public.user_roles ENABLE TRIGGER USER;
  END IF;
END $$;