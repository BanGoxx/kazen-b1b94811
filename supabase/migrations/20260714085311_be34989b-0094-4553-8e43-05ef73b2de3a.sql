-- KAZEN Phase 25 — Live Community Chat (structure + RPCs + seed)
-- Additive only. Realtime publication is intentionally NOT changed here — that
-- is a separate migration after review, per the approved plan.

-- 1. Extend the moderation target enum (additive, non-destructive)
ALTER TYPE public.moderation_target_type ADD VALUE IF NOT EXISTS 'live_chat_message';

-- Commit the enum change so it is visible for the rest of the migration.
COMMIT;
BEGIN;

-- 2. Tables ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.live_chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.live_chat_rooms TO authenticated;
GRANT ALL ON public.live_chat_rooms TO service_role;
ALTER TABLE public.live_chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Live chat rooms readable to members"
ON public.live_chat_rooms FOR SELECT TO authenticated
USING (is_active = true OR public.can_moderate_now(auth.uid()));

CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_chat_rooms(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  reply_to_id uuid REFERENCES public.live_chat_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  hidden_at timestamptz,
  hidden_by uuid
);

CREATE INDEX IF NOT EXISTS live_chat_messages_room_created_idx
  ON public.live_chat_messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS live_chat_messages_author_idx
  ON public.live_chat_messages (author_id, created_at DESC);

GRANT SELECT ON public.live_chat_messages TO authenticated;
GRANT ALL ON public.live_chat_messages TO service_role;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated, room active, not deleted, hidden only to author or moderator
CREATE POLICY "Live chat messages readable"
ON public.live_chat_messages FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.live_chat_rooms r
    WHERE r.id = live_chat_messages.room_id
      AND (r.is_active = true OR public.can_moderate_now(auth.uid()))
  )
  AND (
    hidden_at IS NULL
    OR author_id = auth.uid()
    OR public.can_moderate_now(auth.uid())
  )
);
-- No INSERT/UPDATE/DELETE policies: writes go through SECURITY DEFINER RPCs.

CREATE TABLE IF NOT EXISTS public.live_chat_member_state (
  room_id uuid NOT NULL REFERENCES public.live_chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  muted_at timestamptz,
  restricted_until timestamptz,
  restricted_reason text,
  restricted_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

GRANT SELECT ON public.live_chat_member_state TO authenticated;
GRANT ALL ON public.live_chat_member_state TO service_role;
ALTER TABLE public.live_chat_member_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their own live chat state"
ON public.live_chat_member_state FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_moderate_now(auth.uid()));

-- 3. RPCs --------------------------------------------------------------------

-- Send message
CREATE OR REPLACE FUNCTION public.send_live_chat_message(
  _room uuid, _body text, _reply_to uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  caller uuid := auth.uid();
  b text := regexp_replace(trim(coalesce(_body, '')), '[\u0000-\u0008\u000B\u000C\u000E-\u001F]', '', 'g');
  room_active boolean;
  restricted timestamptz;
  new_user_cutoff timestamptz;
  is_new boolean;
  min_gap interval;
  per_min int;
  per_hour int;
  recent_1 int; recent_min int; recent_hour int;
  new_id uuid;
  rt_room uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentification requise.'; END IF;

  SELECT is_active INTO room_active FROM public.live_chat_rooms WHERE id = _room;
  IF room_active IS NULL THEN RAISE EXCEPTION 'Salon introuvable.'; END IF;
  IF NOT room_active THEN RAISE EXCEPTION 'Le chat en direct est temporairement en lecture seule.'; END IF;

  SELECT restricted_until INTO restricted FROM public.live_chat_member_state
    WHERE room_id = _room AND user_id = caller;
  IF restricted IS NOT NULL AND restricted > now() THEN
    RAISE EXCEPTION 'Tu ne peux pas envoyer de messages pour le moment.';
  END IF;

  IF char_length(b) < 1 OR char_length(b) > 500 THEN
    RAISE EXCEPTION 'Message invalide (1 à 500 caractères).';
  END IF;

  IF _reply_to IS NOT NULL THEN
    SELECT room_id INTO rt_room FROM public.live_chat_messages
      WHERE id = _reply_to AND deleted_at IS NULL;
    IF rt_room IS NULL OR rt_room <> _room THEN
      RAISE EXCEPTION 'Message cité introuvable.';
    END IF;
  END IF;

  -- New account tier (<7 days)
  SELECT (created_at > now() - interval '7 days') INTO is_new
    FROM auth.users WHERE id = caller;
  IF is_new THEN
    min_gap := interval '8 seconds'; per_min := 8; per_hour := 50;
  ELSE
    min_gap := interval '3 seconds'; per_min := 20; per_hour := 150;
  END IF;

  SELECT count(*) INTO recent_1 FROM public.live_chat_messages
    WHERE author_id = caller AND created_at > now() - min_gap;
  IF recent_1 > 0 THEN RAISE EXCEPTION 'Merci de patienter avant d''envoyer un autre message.'; END IF;

  SELECT count(*) INTO recent_min FROM public.live_chat_messages
    WHERE author_id = caller AND created_at > now() - interval '1 minute';
  IF recent_min >= per_min THEN RAISE EXCEPTION 'Trop de messages en peu de temps. Réessaie dans un instant.'; END IF;

  SELECT count(*) INTO recent_hour FROM public.live_chat_messages
    WHERE author_id = caller AND created_at > now() - interval '1 hour';
  IF recent_hour >= per_hour THEN RAISE EXCEPTION 'Limite horaire atteinte. Réessaie plus tard.'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.live_chat_messages
    WHERE author_id = caller AND room_id = _room AND body = b
      AND created_at > now() - interval '2 minutes'
  ) THEN RAISE EXCEPTION 'Message en double détecté.'; END IF;

  INSERT INTO public.live_chat_messages (room_id, author_id, body, reply_to_id)
  VALUES (_room, caller, b, _reply_to) RETURNING id INTO new_id;

  RETURN new_id;
END; $fn$;

-- Edit own message
CREATE OR REPLACE FUNCTION public.edit_live_chat_message(_id uuid, _body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  caller uuid := auth.uid();
  author uuid; created timestamptz; del timestamptz; hid timestamptz;
  b text := regexp_replace(trim(coalesce(_body, '')), '[\u0000-\u0008\u000B\u000C\u000E-\u001F]', '', 'g');
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentification requise.'; END IF;
  SELECT author_id, created_at, deleted_at, hidden_at INTO author, created, del, hid
    FROM public.live_chat_messages WHERE id = _id;
  IF author IS NULL THEN RAISE EXCEPTION 'Message introuvable.'; END IF;
  IF author <> caller THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  IF del IS NOT NULL THEN RAISE EXCEPTION 'Message supprimé.'; END IF;
  IF hid IS NOT NULL THEN RAISE EXCEPTION 'Message modéré.'; END IF;
  IF created < now() - interval '15 minutes' THEN RAISE EXCEPTION 'Modification impossible (délai dépassé).'; END IF;
  IF char_length(b) < 1 OR char_length(b) > 500 THEN RAISE EXCEPTION 'Message invalide.'; END IF;
  UPDATE public.live_chat_messages SET body = b, edited_at = now() WHERE id = _id;
END; $fn$;

-- Delete own message (soft)
CREATE OR REPLACE FUNCTION public.delete_live_chat_message(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE caller uuid := auth.uid(); author uuid; del timestamptz;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentification requise.'; END IF;
  SELECT author_id, deleted_at INTO author, del FROM public.live_chat_messages WHERE id = _id;
  IF author IS NULL THEN RAISE EXCEPTION 'Message introuvable.'; END IF;
  IF author <> caller THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  IF del IS NOT NULL THEN RETURN; END IF;
  UPDATE public.live_chat_messages SET deleted_at = now(), deleted_by = caller WHERE id = _id;
END; $fn$;

-- Mark room read
CREATE OR REPLACE FUNCTION public.mark_live_chat_read(_room uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentification requise.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.live_chat_rooms WHERE id = _room) THEN
    RAISE EXCEPTION 'Salon introuvable.';
  END IF;
  INSERT INTO public.live_chat_member_state (room_id, user_id, last_read_at, updated_at)
  VALUES (_room, caller, now(), now())
  ON CONFLICT (room_id, user_id) DO UPDATE SET last_read_at = now(), updated_at = now();
END; $fn$;

-- Report a message (delegates to submit_content_report)
CREATE OR REPLACE FUNCTION public.report_live_chat_message(_id uuid, _reason text, _details text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE caller uuid := auth.uid(); exists_msg boolean; new_id uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentification requise.'; END IF;
  SELECT true INTO exists_msg FROM public.live_chat_messages WHERE id = _id;
  IF exists_msg IS NULL THEN RAISE EXCEPTION 'Message introuvable.'; END IF;
  new_id := public.submit_content_report('live_chat_message'::public.moderation_target_type, _id, _reason, _details);
  RETURN new_id;
END; $fn$;

-- Moderator: hide
CREATE OR REPLACE FUNCTION public.hide_live_chat_message(_id uuid, _reason text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentification requise.'; END IF;
  IF NOT public.can_moderate_now(caller) THEN RAISE EXCEPTION 'Privilèges insuffisants.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.live_chat_messages WHERE id = _id) THEN
    RAISE EXCEPTION 'Message introuvable.';
  END IF;
  UPDATE public.live_chat_messages SET hidden_at = now(), hidden_by = caller WHERE id = _id;
  INSERT INTO public.moderation_actions (actor_id, target_type, target_id, action, reason, note)
  VALUES (caller, 'live_chat_message', _id, 'hide', coalesce(_reason,''), '');
END; $fn$;

-- Moderator: restore
CREATE OR REPLACE FUNCTION public.restore_live_chat_message(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentification requise.'; END IF;
  IF NOT public.can_moderate_now(caller) THEN RAISE EXCEPTION 'Privilèges insuffisants.'; END IF;
  UPDATE public.live_chat_messages SET hidden_at = NULL, hidden_by = NULL WHERE id = _id;
  INSERT INTO public.moderation_actions (actor_id, target_type, target_id, action, reason, note)
  VALUES (caller, 'live_chat_message', _id, 'unhide', '', '');
END; $fn$;

-- Moderator: restrict a member
CREATE OR REPLACE FUNCTION public.restrict_live_chat_member(_room uuid, _user uuid, _minutes int, _reason text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE caller uuid := auth.uid(); until_ts timestamptz;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentification requise.'; END IF;
  IF NOT public.can_moderate_now(caller) THEN RAISE EXCEPTION 'Privilèges insuffisants.'; END IF;
  IF _minutes IS NULL OR _minutes < 1 OR _minutes > 10080 THEN RAISE EXCEPTION 'Durée invalide.'; END IF;
  until_ts := now() + make_interval(mins => _minutes);
  INSERT INTO public.live_chat_member_state (room_id, user_id, restricted_until, restricted_reason, restricted_by, updated_at)
  VALUES (_room, _user, until_ts, left(coalesce(_reason,''), 500), caller, now())
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET restricted_until = until_ts,
        restricted_reason = left(coalesce(_reason,''), 500),
        restricted_by = caller, updated_at = now();
END; $fn$;

-- Moderator: unrestrict
CREATE OR REPLACE FUNCTION public.unrestrict_live_chat_member(_room uuid, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentification requise.'; END IF;
  IF NOT public.can_moderate_now(caller) THEN RAISE EXCEPTION 'Privilèges insuffisants.'; END IF;
  UPDATE public.live_chat_member_state
    SET restricted_until = NULL, restricted_reason = NULL, restricted_by = NULL, updated_at = now()
    WHERE room_id = _room AND user_id = _user;
END; $fn$;

-- Owner: kill switch
CREATE OR REPLACE FUNCTION public.set_live_chat_room_active(_room uuid, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentification requise.'; END IF;
  IF NOT public.has_role(caller, 'owner') THEN RAISE EXCEPTION 'Seul le propriétaire peut modifier ce paramètre.'; END IF;
  UPDATE public.live_chat_rooms SET is_active = _active, updated_at = now() WHERE id = _room;
END; $fn$;

-- Owner diagnostics
CREATE OR REPLACE FUNCTION public.live_chat_admin_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE caller uuid := auth.uid(); day_start timestamptz := date_trunc('day', now());
BEGIN
  IF caller IS NULL OR NOT public.has_role(caller, 'owner') THEN
    RAISE EXCEPTION 'Privilèges insuffisants.';
  END IF;
  RETURN jsonb_build_object(
    'rooms', (SELECT jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'name', name, 'is_active', is_active)) FROM public.live_chat_rooms),
    'messages_today', (SELECT count(*) FROM public.live_chat_messages WHERE created_at >= day_start),
    'unique_authors_today', (SELECT count(DISTINCT author_id) FROM public.live_chat_messages WHERE created_at >= day_start),
    'hidden_today', (SELECT count(*) FROM public.live_chat_messages WHERE hidden_at >= day_start),
    'restricted_members', (SELECT count(*) FROM public.live_chat_member_state WHERE restricted_until IS NOT NULL AND restricted_until > now()),
    'open_reports', (SELECT count(*) FROM public.content_reports WHERE target_type = 'live_chat_message' AND status IN ('pending','reviewing'))
  );
END; $fn$;

-- 4. Seed the single approved room ------------------------------------------
INSERT INTO public.live_chat_rooms (slug, name, description, is_active)
VALUES ('general', 'Général KAZEN', 'Le salon public de la communauté KAZEN.', true)
ON CONFLICT (slug) DO NOTHING;

-- 5. updated_at trigger on rooms
DROP TRIGGER IF EXISTS trg_live_chat_rooms_updated ON public.live_chat_rooms;
CREATE TRIGGER trg_live_chat_rooms_updated
  BEFORE UPDATE ON public.live_chat_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
