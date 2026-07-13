CREATE OR REPLACE FUNCTION public.request_conversation(_target uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF EXISTS (SELECT 1 FROM public.chat_participants
               WHERE conversation_id = conv AND blocked_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Conversation indisponible.';
    END IF;
    RETURN conv;
  END IF;

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
    '/messages');

  RETURN conv;
END; $function$;

CREATE OR REPLACE FUNCTION public.accept_conversation(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    '/messages');
END; $function$;

CREATE OR REPLACE FUNCTION public.send_chat_message(_conv uuid, _body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'Nouveau message', left(b, 140), '/messages');
  END IF;
  RETURN mid;
END; $function$;