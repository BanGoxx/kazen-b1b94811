CREATE OR REPLACE FUNCTION public.notify_member(
  _user uuid, _type text, _event_key text, _title text, _message text, _url text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  enabled boolean;
  quiet boolean;
BEGIN
  SELECT COALESCE(shared_list_enabled, true), COALESCE(quiet_mode, false)
    INTO enabled, quiet
    FROM public.member_notification_preferences
    WHERE user_id = _user;
  IF enabled IS NULL THEN enabled := true; END IF;
  IF quiet IS NULL THEN quiet := false; END IF;
  IF NOT enabled OR quiet THEN RETURN; END IF;

  INSERT INTO public.member_notifications
    (user_id, notification_type, event_key, title, message, destination_url, occurred_at)
  VALUES (_user, _type, _event_key, left(_title,160), left(_message,500), _url, now())
  ON CONFLICT (user_id, event_key) DO NOTHING;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.request_playlist_join(_playlist uuid, _message text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  caller uuid := auth.uid();
  owner uuid;
  is_pub boolean;
  ptitle text;
  new_id uuid;
  rname text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT owner_id, is_public, title INTO owner, is_pub, ptitle
    FROM public.playlists WHERE id = _playlist AND hidden_at IS NULL AND deleted_at IS NULL;
  IF owner IS NULL THEN RAISE EXCEPTION 'Playlist not found.'; END IF;
  IF caller = owner THEN RAISE EXCEPTION 'You already own this list.'; END IF;
  IF NOT is_pub THEN RAISE EXCEPTION 'This list is private.'; END IF;
  IF public.is_playlist_collaborator(_playlist, caller) THEN
    RAISE EXCEPTION 'You already collaborate on this list.';
  END IF;

  INSERT INTO public.playlist_requests (playlist_id, requester_id, message)
  VALUES (_playlist, caller, left(COALESCE(_message,''), 500))
  ON CONFLICT (playlist_id, requester_id) WHERE status = 'pending'
  DO UPDATE SET message = EXCLUDED.message, updated_at = now()
  RETURNING id INTO new_id;

  SELECT display_name INTO rname FROM public.profiles WHERE id = caller;

  PERFORM public.notify_member(
    owner, 'shared_list_request',
    'plreq:' || _playlist::text || ':' || caller::text,
    'Nouvelle demande de collaboration',
    COALESCE(rname, 'Un membre') || ' souhaite rejoindre « ' || ptitle || ' ».',
    '/playlist/' || _playlist::text
  );

  RETURN new_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.decide_playlist_request(_request uuid, _accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  caller uuid := auth.uid();
  owner uuid;
  pid uuid;
  requester uuid;
  ptitle text;
  cur_status text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT r.playlist_id, r.requester_id, r.status, p.owner_id, p.title
    INTO pid, requester, cur_status, owner, ptitle
    FROM public.playlist_requests r
    JOIN public.playlists p ON p.id = r.playlist_id
    WHERE r.id = _request;
  IF pid IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  IF caller <> owner THEN RAISE EXCEPTION 'Only the owner can decide.'; END IF;
  IF cur_status <> 'pending' THEN RAISE EXCEPTION 'Request already decided.'; END IF;

  IF _accept THEN
    INSERT INTO public.playlist_collaborators (playlist_id, user_id, role, invited_by)
    VALUES (pid, requester, 'editor', caller)
    ON CONFLICT (playlist_id, user_id) DO NOTHING;
    UPDATE public.playlist_requests
      SET status = 'accepted', decided_by = caller, decided_at = now()
      WHERE id = _request;
    PERFORM public.notify_member(
      requester, 'shared_list_request_accepted',
      'plreqacc:' || pid::text || ':' || requester::text,
      'Demande acceptée',
      'Tu peux désormais éditer « ' || ptitle || ' ».',
      '/playlist/' || pid::text
    );
  ELSE
    UPDATE public.playlist_requests
      SET status = 'declined', decided_by = caller, decided_at = now()
      WHERE id = _request;
    PERFORM public.notify_member(
      requester, 'shared_list_request_declined',
      'plreqdec:' || pid::text || ':' || requester::text || ':' || _request::text,
      'Demande refusée',
      'Ta demande pour « ' || ptitle || ' » n''a pas été retenue.',
      '/playlist/' || pid::text
    );
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.notify_member(uuid, text, text, text, text, text) FROM anon, authenticated;