-- 1. Privacy columns on profiles (identity already public via authorship)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_bio boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_playlists boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_reviews boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_favorites boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_stats boolean NOT NULL DEFAULT true;

-- 2. Member blocks
CREATE TABLE IF NOT EXISTS public.member_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.member_blocks TO authenticated;
GRANT ALL ON public.member_blocks TO service_role;
ALTER TABLE public.member_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own blocks" ON public.member_blocks
  FOR ALL TO authenticated
  USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

-- 3. Public profile summary (safe fields only)
CREATE OR REPLACE FUNCTION public.get_public_profile(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  viewer uuid := auth.uid();
  p public.profiles;
  blocked_either boolean;
  eligible boolean;
BEGIN
  IF _id IS NULL THEN RETURN jsonb_build_object('exists', false); END IF;
  SELECT * INTO p FROM public.profiles WHERE id = _id;
  IF NOT FOUND THEN RETURN jsonb_build_object('exists', false); END IF;

  IF NOT p.profile_public AND (viewer IS NULL OR viewer <> _id) THEN
    RETURN jsonb_build_object('exists', true, 'hidden', true, 'is_self', false);
  END IF;

  blocked_either := viewer IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.member_blocks b
    WHERE (b.blocker_id = viewer AND b.blocked_id = _id)
       OR (b.blocker_id = _id AND b.blocked_id = viewer));

  eligible := viewer IS NOT NULL AND viewer <> _id
              AND coalesce(p.accepts_chat, true) AND NOT blocked_either;

  RETURN jsonb_build_object(
    'exists', true,
    'hidden', false,
    'is_self', viewer = _id,
    'id', p.id,
    'display_name', coalesce(p.display_name, 'Membre KAZEN'),
    'avatar_url', p.avatar_url,
    'bio', CASE WHEN p.show_bio THEN p.bio ELSE NULL END,
    'member_since', p.created_at,
    'show_bio', p.show_bio,
    'show_playlists', p.show_playlists,
    'show_reviews', p.show_reviews,
    'show_favorites', p.show_favorites,
    'show_stats', p.show_stats,
    'playlists_count', CASE WHEN p.show_stats OR p.show_playlists THEN
        (SELECT count(*) FROM public.playlists pl
          WHERE pl.owner_id = _id AND pl.is_public
            AND pl.hidden_at IS NULL AND pl.deleted_at IS NULL) ELSE NULL END,
    'reviews_count', CASE WHEN p.show_stats OR p.show_reviews THEN
        (SELECT count(*) FROM public.fiche_reviews r
          WHERE r.user_id = _id AND r.hidden_at IS NULL AND r.deleted_at IS NULL) ELSE NULL END,
    'favorites_count', CASE WHEN p.show_stats AND p.show_favorites THEN
        (SELECT count(*) FROM public.list_items li
          WHERE li.user_id = _id AND li.favorite = true) ELSE NULL END,
    'chat_eligible', eligible,
    'is_blocked_by_me', viewer IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.member_blocks b
        WHERE b.blocker_id = viewer AND b.blocked_id = _id)
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;

-- 4. Public favorites (only when owner opted in)
CREATE OR REPLACE FUNCTION public.get_public_favorites(_id uuid)
RETURNS TABLE(media_key text, source text, external_id text, media_type text, title text, poster_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT li.media_key, m.source, m.external_id, m.media_type::text, m.title, m.poster_url
  FROM public.list_items li
  JOIN public.profiles p ON p.id = li.user_id
  LEFT JOIN public.media_records m ON m.media_key = li.media_key
  WHERE li.user_id = _id AND li.favorite = true
    AND p.profile_public AND p.show_favorites
  ORDER BY li.updated_at DESC
  LIMIT 12;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_favorites(uuid) TO anon, authenticated;

-- 5. Block / unblock a member
CREATE OR REPLACE FUNCTION public.set_member_block(_target uuid, _blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF _target IS NULL OR _target = caller THEN RAISE EXCEPTION 'Cible invalide.'; END IF;
  IF _blocked THEN
    INSERT INTO public.member_blocks (blocker_id, blocked_id)
    VALUES (caller, _target) ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
  ELSE
    DELETE FROM public.member_blocks WHERE blocker_id = caller AND blocked_id = _target;
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_member_block(uuid, boolean) TO authenticated;

-- 6. Strengthen chat requests to honour member blocks
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

  IF EXISTS (SELECT 1 FROM public.member_blocks b
             WHERE (b.blocker_id = caller AND b.blocked_id = _target)
                OR (b.blocker_id = _target AND b.blocked_id = caller)) THEN
    RAISE EXCEPTION 'Conversation indisponible.';
  END IF;

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