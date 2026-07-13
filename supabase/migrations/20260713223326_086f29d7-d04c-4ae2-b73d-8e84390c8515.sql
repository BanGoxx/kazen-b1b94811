-- =========================================================
-- KAZEN Phase 13 — Private 1:1 member chat (additive)
-- =========================================================

-- ---------- Profiles: single additive opt-out column ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepts_chat boolean NOT NULL DEFAULT true;

-- ---------- Tables ----------
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  CONSTRAINT chat_conv_status_chk CHECK (status IN ('pending','active','blocked','closed'))
);

CREATE TABLE public.chat_participants (
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  muted_at timestamptz,
  archived_at timestamptz,
  blocked_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  hidden_at timestamptz,
  hidden_by uuid,
  CONSTRAINT chat_msg_body_len CHECK (char_length(body) BETWEEN 1 AND 4000)
);

-- ---------- Grants (read via RLS; writes via SECURITY DEFINER RPCs only) ----------
GRANT SELECT ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
GRANT SELECT ON public.chat_participants TO authenticated;
GRANT ALL ON public.chat_participants TO service_role;
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

-- ---------- Indexes ----------
CREATE INDEX idx_chat_conv_last_msg ON public.chat_conversations (last_message_at DESC NULLS LAST);
CREATE INDEX idx_chat_part_user ON public.chat_participants (user_id);
CREATE INDEX idx_chat_msg_conv_created ON public.chat_messages (conversation_id, created_at DESC);
CREATE INDEX idx_chat_msg_moderation ON public.chat_messages (hidden_at, deleted_at);

-- ---------- updated_at trigger (reuses existing function) ----------
CREATE TRIGGER trg_chat_conv_updated_at BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Helpers ----------
CREATE OR REPLACE FUNCTION public.chat_pair_key(_a uuid, _b uuid)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT least(_a::text, _b::text) || ':' || greatest(_a::text, _b::text);
$$;

CREATE OR REPLACE FUNCTION public.is_chat_participant(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE conversation_id = _conv AND user_id = _user
  );
$$;

-- ---------- RLS ----------
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Participants can read their own conversations only.
CREATE POLICY "Participants read own conversations"
ON public.chat_conversations FOR SELECT TO authenticated
USING (public.is_chat_participant(id, auth.uid()));

-- Participants can read participant rows in their own conversations.
CREATE POLICY "Participants read conversation members"
ON public.chat_participants FOR SELECT TO authenticated
USING (public.is_chat_participant(conversation_id, auth.uid()));

-- Participants read messages in their conversations; moderator-hidden rows are
-- excluded (visible only through the report-scoped moderation path).
CREATE POLICY "Participants read own messages"
ON public.chat_messages FOR SELECT TO authenticated
USING (public.is_chat_participant(conversation_id, auth.uid()) AND hidden_at IS NULL);

-- No INSERT/UPDATE/DELETE policies: every write goes through the RPCs below.

-- =========================================================
-- RPCs (all SECURITY DEFINER, fixed search_path, identity = auth.uid())
-- =========================================================

-- Start (or reopen) a 1:1 conversation from a member profile.
CREATE OR REPLACE FUNCTION public.request_conversation(_target uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  pkey text;
  conv uuid;
  cstatus text;
  target_accepts boolean;
  recent int;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF _target IS NULL OR _target = caller THEN RAISE EXCEPTION 'Destinataire invalide.'; END IF;
  SELECT accepts_chat INTO target_accepts FROM public.profiles WHERE id = _target;
  IF target_accepts IS NULL THEN RAISE EXCEPTION 'Membre introuvable.'; END IF;

  pkey := public.chat_pair_key(caller, _target);
  SELECT id, status INTO conv, cstatus FROM public.chat_conversations WHERE pair_key = pkey;

  IF conv IS NOT NULL THEN
    -- Reopen / idempotent. Never bypass an active block.
    IF EXISTS (SELECT 1 FROM public.chat_participants
               WHERE conversation_id = conv AND blocked_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Conversation indisponible.';
    END IF;
    RETURN conv;
  END IF;

  -- Only enforce accepts_chat when creating a brand-new conversation.
  IF target_accepts = false THEN RAISE EXCEPTION 'Ce membre n''accepte pas de nouveaux messages.'; END IF;

  SELECT count(*) INTO recent
  FROM public.chat_conversations c
  JOIN public.chat_participants p ON p.conversation_id = c.id AND p.user_id = caller
  WHERE c.requested_by = caller AND c.created_at > now() - interval '15 minutes';
  IF recent >= 10 THEN RAISE EXCEPTION 'Trop de demandes récemment. Réessaie plus tard.'; END IF;

  INSERT INTO public.chat_conversations (pair_key, status, requested_by)
  VALUES (pkey, 'pending', caller)
  RETURNING id INTO conv;

  INSERT INTO public.chat_participants (conversation_id, user_id) VALUES (conv, caller), (conv, _target);

  PERFORM public.notify_member(_target, 'chat_request',
    'chatreq:' || conv::text,
    'Nouvelle demande de message',
    'Un membre souhaite discuter avec toi.',
    '/messages/' || conv::text);

  RETURN conv;
END; $$;

-- Recipient accepts a pending request.
CREATE OR REPLACE FUNCTION public.accept_conversation(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); rq uuid; st text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT public.is_chat_participant(_id, caller) THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  SELECT requested_by, status INTO rq, st FROM public.chat_conversations WHERE id = _id;
  IF rq IS NULL THEN RAISE EXCEPTION 'Conversation introuvable.'; END IF;
  IF caller = rq THEN RAISE EXCEPTION 'En attente de la réponse du destinataire.'; END IF;
  IF st = 'active' THEN RETURN; END IF;
  IF st <> 'pending' THEN RAISE EXCEPTION 'Conversation indisponible.'; END IF;
  UPDATE public.chat_conversations SET status = 'active', updated_at = now() WHERE id = _id;
  PERFORM public.notify_member(rq, 'chat_request_accepted',
    'chatacc:' || _id::text,
    'Demande de message acceptée',
    'Ta demande de conversation a été acceptée.',
    '/messages/' || _id::text);
END; $$;

-- Recipient declines a pending request (closes it).
CREATE OR REPLACE FUNCTION public.decline_conversation(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); rq uuid; st text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT public.is_chat_participant(_id, caller) THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  SELECT requested_by, status INTO rq, st FROM public.chat_conversations WHERE id = _id;
  IF rq IS NULL THEN RAISE EXCEPTION 'Conversation introuvable.'; END IF;
  IF caller = rq THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  IF st = 'closed' THEN RETURN; END IF;
  UPDATE public.chat_conversations SET status = 'closed', updated_at = now() WHERE id = _id AND status = 'pending';
END; $$;

-- Send a message (active conversations only, block-checked, rate-limited).
CREATE OR REPLACE FUNCTION public.send_chat_message(_conv uuid, _body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  st text;
  b text := regexp_replace(trim(coalesce(_body,'')), '[\u0000-\u0008\u000B\u000C\u000E-\u001F]', '', 'g');
  other uuid;
  mid uuid;
  recent int;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT public.is_chat_participant(_conv, caller) THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  SELECT status INTO st FROM public.chat_conversations WHERE id = _conv;
  IF st IS NULL THEN RAISE EXCEPTION 'Conversation introuvable.'; END IF;
  IF st <> 'active' THEN RAISE EXCEPTION 'Conversation non active.'; END IF;
  IF EXISTS (SELECT 1 FROM public.chat_participants WHERE conversation_id = _conv AND blocked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Conversation indisponible.';
  END IF;
  IF char_length(b) < 1 OR char_length(b) > 4000 THEN RAISE EXCEPTION 'Message invalide.'; END IF;

  SELECT count(*) INTO recent FROM public.chat_messages
    WHERE sender_id = caller AND created_at > now() - interval '10 minutes';
  IF recent >= 30 THEN RAISE EXCEPTION 'Trop de messages envoyés récemment. Réessaie plus tard.'; END IF;
  IF EXISTS (SELECT 1 FROM public.chat_messages
      WHERE sender_id = caller AND conversation_id = _conv AND body = b
        AND created_at > now() - interval '2 minutes') THEN
    RAISE EXCEPTION 'Message en double détecté.';
  END IF;

  INSERT INTO public.chat_messages (conversation_id, sender_id, body)
  VALUES (_conv, caller, b) RETURNING id INTO mid;
  UPDATE public.chat_conversations SET last_message_at = now(), updated_at = now() WHERE id = _conv;

  SELECT user_id INTO other FROM public.chat_participants
    WHERE conversation_id = _conv AND user_id <> caller LIMIT 1;
  IF other IS NOT NULL THEN
    PERFORM public.notify_member(other, 'chat_message',
      'chatmsg:' || _conv::text || ':' || other::text,
      'Nouveau message', left(b, 140), '/messages/' || _conv::text);
  END IF;
  RETURN mid;
END; $$;

-- Edit own message (within a short window).
CREATE OR REPLACE FUNCTION public.edit_chat_message(_id uuid, _body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  s uuid; created timestamptz; del timestamptz;
  b text := regexp_replace(trim(coalesce(_body,'')), '[\u0000-\u0008\u000B\u000C\u000E-\u001F]', '', 'g');
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT sender_id, created_at, deleted_at INTO s, created, del FROM public.chat_messages WHERE id = _id;
  IF s IS NULL THEN RAISE EXCEPTION 'Message introuvable.'; END IF;
  IF s <> caller THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  IF del IS NOT NULL THEN RAISE EXCEPTION 'Message supprimé.'; END IF;
  IF created < now() - interval '15 minutes' THEN RAISE EXCEPTION 'Modification impossible (délai dépassé).'; END IF;
  IF char_length(b) < 1 OR char_length(b) > 4000 THEN RAISE EXCEPTION 'Message invalide.'; END IF;
  UPDATE public.chat_messages SET body = b, edited_at = now() WHERE id = _id;
END; $$;

-- Soft-delete own message.
CREATE OR REPLACE FUNCTION public.delete_chat_message(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); s uuid; del timestamptz;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT sender_id, deleted_at INTO s, del FROM public.chat_messages WHERE id = _id;
  IF s IS NULL THEN RAISE EXCEPTION 'Message introuvable.'; END IF;
  IF s <> caller THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  IF del IS NOT NULL THEN RETURN; END IF;
  UPDATE public.chat_messages SET deleted_at = now(), deleted_by = caller WHERE id = _id;
END; $$;

-- Mark conversation read + clear the coalesced message notification.
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT public.is_chat_participant(_id, caller) THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  UPDATE public.chat_participants SET last_read_at = now()
    WHERE conversation_id = _id AND user_id = caller;
  DELETE FROM public.member_notifications
    WHERE user_id = caller AND event_key = 'chatmsg:' || _id::text || ':' || caller::text;
END; $$;

-- Archive / unarchive for the caller only.
CREATE OR REPLACE FUNCTION public.archive_conversation(_id uuid, _archived boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT public.is_chat_participant(_id, caller) THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  UPDATE public.chat_participants
    SET archived_at = CASE WHEN _archived THEN now() ELSE NULL END
    WHERE conversation_id = _id AND user_id = caller;
END; $$;

-- Block / unblock the other member (chat-scoped, symmetric hard stop).
CREATE OR REPLACE FUNCTION public.block_chat_member(_id uuid, _blocked boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); other uuid; still_blocked boolean;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT public.is_chat_participant(_id, caller) THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  UPDATE public.chat_participants
    SET blocked_at = CASE WHEN _blocked THEN now() ELSE NULL END
    WHERE conversation_id = _id AND user_id = caller;

  IF _blocked THEN
    UPDATE public.chat_conversations SET status = 'blocked', updated_at = now() WHERE id = _id;
    SELECT user_id INTO other FROM public.chat_participants
      WHERE conversation_id = _id AND user_id <> caller LIMIT 1;
    IF other IS NOT NULL THEN
      DELETE FROM public.member_notifications
        WHERE user_id = caller AND event_key = 'chatmsg:' || _id::text || ':' || caller::text;
    END IF;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.chat_participants
      WHERE conversation_id = _id AND blocked_at IS NOT NULL) INTO still_blocked;
    IF NOT still_blocked THEN
      UPDATE public.chat_conversations SET status = 'active', updated_at = now() WHERE id = _id;
    END IF;
  END IF;
END; $$;

-- Report a chat message (participant-only wrapper over the report spine).
CREATE OR REPLACE FUNCTION public.report_chat_message(_id uuid, _reason text, _details text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); conv uuid; new_id uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT conversation_id INTO conv FROM public.chat_messages WHERE id = _id;
  IF conv IS NULL THEN RAISE EXCEPTION 'Message introuvable.'; END IF;
  IF NOT public.is_chat_participant(conv, caller) THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  new_id := public.submit_content_report('chat_message'::public.moderation_target_type, _id, _reason, _details);
  RETURN new_id;
END; $$;

-- Report-scoped moderation reader: reported message + tight surrounding window.
-- Moderators only; returns nothing unless an open report references the message.
CREATE OR REPLACE FUNCTION public.moderation_chat_context(_message uuid)
RETURNS TABLE(id uuid, conversation_id uuid, sender_id uuid, body text,
              created_at timestamptz, edited_at timestamptz, deleted_at timestamptz,
              hidden_at timestamptz, is_target boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH tgt AS (
    SELECT m.id, m.conversation_id, m.created_at
    FROM public.chat_messages m
    WHERE m.id = _message
      AND public.can_moderate_now(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.content_reports r
        WHERE r.target_type = 'chat_message'
          AND r.target_id = _message
      )
  )
  SELECT c.id, c.conversation_id, c.sender_id, c.body, c.created_at, c.edited_at,
         c.deleted_at, c.hidden_at, (c.id = tgt.id) AS is_target
  FROM public.chat_messages c
  JOIN tgt ON tgt.conversation_id = c.conversation_id
  WHERE c.created_at BETWEEN tgt.created_at - interval '10 minutes'
                        AND tgt.created_at + interval '10 minutes'
  ORDER BY c.created_at ASC
  LIMIT 21;
$$;

-- ---------- EXECUTE grants: signed-in members only (revoke public/anon) ----------
REVOKE ALL ON FUNCTION public.request_conversation(uuid) FROM public;
REVOKE ALL ON FUNCTION public.accept_conversation(uuid) FROM public;
REVOKE ALL ON FUNCTION public.decline_conversation(uuid) FROM public;
REVOKE ALL ON FUNCTION public.send_chat_message(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.edit_chat_message(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.delete_chat_message(uuid) FROM public;
REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM public;
REVOKE ALL ON FUNCTION public.archive_conversation(uuid, boolean) FROM public;
REVOKE ALL ON FUNCTION public.block_chat_member(uuid, boolean) FROM public;
REVOKE ALL ON FUNCTION public.report_chat_message(uuid, text, text) FROM public;
REVOKE ALL ON FUNCTION public.moderation_chat_context(uuid) FROM public;
REVOKE ALL ON FUNCTION public.is_chat_participant(uuid, uuid) FROM public;

GRANT EXECUTE ON FUNCTION public.request_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_chat_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_chat_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_conversation(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_chat_member(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_chat_message(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderation_chat_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_participant(uuid, uuid) TO authenticated;

-- =========================================================
-- Patch the report + moderation spine for 'chat_message'
-- =========================================================
CREATE OR REPLACE FUNCTION public.submit_content_report(_target_type moderation_target_type, _target_id uuid, _reason text, _details text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
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
    WHEN 'chat_message' THEN EXISTS (SELECT 1 FROM public.chat_messages WHERE id = _target_id)
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

CREATE OR REPLACE FUNCTION public.moderate_content(_target_type moderation_target_type, _target_id uuid, _action moderation_action_type, _reason text DEFAULT ''::text, _note text DEFAULT ''::text, _report_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
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
    WHEN 'chat_message' THEN EXISTS (SELECT 1 FROM public.chat_messages WHERE id = _target_id)
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
    ELSIF _target_type = 'chat_message' THEN
      UPDATE public.chat_messages SET
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