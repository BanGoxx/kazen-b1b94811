
-- ============================================================
-- KAZEN Community Forum — additive foundation (H1 + H2 schema)
-- ============================================================

-- Notification preferences (additive columns) ---------------------------------
ALTER TABLE public.member_notification_preferences
  ADD COLUMN IF NOT EXISTS forum_reply_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS forum_mention_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS forum_moderation_enabled boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- forum_categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forum_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'MessageSquare',
  sort_order integer NOT NULL DEFAULT 100,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.forum_categories TO anon, authenticated;
GRANT ALL ON public.forum_categories TO service_role;
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read forum categories"
  ON public.forum_categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TRIGGER update_forum_categories_updated_at
  BEFORE UPDATE ON public.forum_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- forum_topics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forum_topics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.forum_categories(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  reply_count integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  hidden_at timestamptz,
  hidden_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_topics_category_activity_idx
  ON public.forum_topics (category_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS forum_topics_activity_idx
  ON public.forum_topics (last_activity_at DESC);
CREATE INDEX IF NOT EXISTS forum_topics_author_idx
  ON public.forum_topics (author_id);

GRANT SELECT ON public.forum_topics TO anon, authenticated;
GRANT ALL ON public.forum_topics TO service_role;
ALTER TABLE public.forum_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read visible topics"
  ON public.forum_topics FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL AND hidden_at IS NULL);

CREATE POLICY "Authors can read own topics"
  ON public.forum_topics FOR SELECT
  TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "Moderators can read all topics"
  ON public.forum_topics FOR SELECT
  TO authenticated
  USING (public.can_moderate_now(auth.uid()));

CREATE TRIGGER update_forum_topics_updated_at
  BEFORE UPDATE ON public.forum_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- forum_posts (replies)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forum_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id uuid NOT NULL REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  reply_to_id uuid REFERENCES public.forum_posts(id) ON DELETE SET NULL,
  hidden_at timestamptz,
  hidden_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_posts_topic_created_idx
  ON public.forum_posts (topic_id, created_at);
CREATE INDEX IF NOT EXISTS forum_posts_author_idx
  ON public.forum_posts (author_id);

GRANT SELECT ON public.forum_posts TO anon, authenticated;
GRANT ALL ON public.forum_posts TO service_role;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read visible posts"
  ON public.forum_posts FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL AND hidden_at IS NULL);

CREATE POLICY "Authors can read own posts"
  ON public.forum_posts FOR SELECT
  TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "Moderators can read all posts"
  ON public.forum_posts FOR SELECT
  TO authenticated
  USING (public.can_moderate_now(auth.uid()));

CREATE TRIGGER update_forum_posts_updated_at
  BEFORE UPDATE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- forum_reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forum_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN ('topic','post')),
  target_id uuid NOT NULL,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewing','dismissed','action_taken')),
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS forum_reports_open_unique
  ON public.forum_reports (reporter_id, target_type, target_id)
  WHERE status IN ('pending','reviewing');
CREATE INDEX IF NOT EXISTS forum_reports_status_idx
  ON public.forum_reports (status, created_at DESC);

GRANT SELECT ON public.forum_reports TO authenticated;
GRANT ALL ON public.forum_reports TO service_role;
ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters can read own forum reports"
  ON public.forum_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

CREATE POLICY "Moderators can read all forum reports"
  ON public.forum_reports FOR SELECT
  TO authenticated
  USING (public.can_moderate_now(auth.uid()));

CREATE TRIGGER update_forum_reports_updated_at
  BEFORE UPDATE ON public.forum_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Notification helper (respects prefs, quiet mode, snooze; deduped)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.forum_notify(
  _user uuid, _type text, _event_key text, _title text, _message text, _url text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE enabled boolean; quiet boolean; snooze timestamptz;
BEGIN
  IF _user IS NULL THEN RETURN; END IF;
  SELECT
    CASE _type
      WHEN 'forum_reply' THEN COALESCE(forum_reply_enabled, true)
      WHEN 'forum_mention' THEN COALESCE(forum_mention_enabled, true)
      WHEN 'forum_moderation' THEN COALESCE(forum_moderation_enabled, true)
      ELSE true END,
    COALESCE(quiet_mode, false), snooze_until
  INTO enabled, quiet, snooze
  FROM public.member_notification_preferences
  WHERE user_id = _user;
  IF enabled IS NULL THEN enabled := true; END IF;
  IF NOT enabled THEN RETURN; END IF;
  IF quiet THEN RETURN; END IF;
  IF snooze IS NOT NULL AND snooze > now() THEN RETURN; END IF;

  INSERT INTO public.member_notifications
    (user_id, notification_type, event_key, title, message, destination_url, occurred_at)
  VALUES (_user, _type, _event_key, left(_title, 160), left(_message, 500), _url, now())
  ON CONFLICT (user_id, event_key) DO NOTHING;
END;$$;

-- ---------------------------------------------------------------------------
-- create_forum_topic (auth + validation + rate limit)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_forum_topic(
  _category uuid, _title text, _body text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  cat_id uuid; cat_locked boolean;
  new_id uuid;
  t text := trim(coalesce(_title, ''));
  b text := trim(coalesce(_body, ''));
  recent integer;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT id, is_locked INTO cat_id, cat_locked FROM public.forum_categories WHERE id = _category;
  IF cat_id IS NULL THEN RAISE EXCEPTION 'Catégorie introuvable.'; END IF;
  IF cat_locked THEN RAISE EXCEPTION 'Cette catégorie est verrouillée.'; END IF;
  IF char_length(t) < 3 THEN RAISE EXCEPTION 'Le titre est trop court.'; END IF;
  IF char_length(t) > 160 THEN RAISE EXCEPTION 'Le titre est trop long.'; END IF;
  IF char_length(b) < 1 THEN RAISE EXCEPTION 'Le message est vide.'; END IF;
  IF char_length(b) > 20000 THEN RAISE EXCEPTION 'Le message est trop long.'; END IF;

  SELECT count(*) INTO recent FROM public.forum_topics
    WHERE author_id = caller AND created_at > now() - interval '15 minutes';
  IF recent >= 5 THEN RAISE EXCEPTION 'Trop de sujets créés récemment. Réessaie plus tard.'; END IF;
  IF EXISTS (SELECT 1 FROM public.forum_topics
      WHERE author_id = caller AND lower(title) = lower(t)
        AND created_at > now() - interval '10 minutes') THEN
    RAISE EXCEPTION 'Sujet en double détecté.';
  END IF;

  INSERT INTO public.forum_topics (category_id, author_id, title, body, last_activity_at)
  VALUES (_category, caller, left(t, 160), b, now())
  RETURNING id INTO new_id;
  RETURN new_id;
END;$$;

-- ---------------------------------------------------------------------------
-- create_forum_post (auth + validation + rate limit + notifications)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_forum_post(
  _topic uuid, _body text, _reply_to uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  t_author uuid; t_locked boolean; t_hidden timestamptz; t_deleted timestamptz;
  new_id uuid;
  b text := trim(coalesce(_body, ''));
  recent integer;
  rt_author uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT author_id, is_locked, hidden_at, deleted_at
    INTO t_author, t_locked, t_hidden, t_deleted
    FROM public.forum_topics WHERE id = _topic;
  IF t_author IS NULL THEN RAISE EXCEPTION 'Sujet introuvable.'; END IF;
  IF t_deleted IS NOT NULL OR t_hidden IS NOT NULL THEN RAISE EXCEPTION 'Sujet indisponible.'; END IF;
  IF t_locked THEN RAISE EXCEPTION 'Ce sujet est verrouillé.'; END IF;
  IF char_length(b) < 1 THEN RAISE EXCEPTION 'Le message est vide.'; END IF;
  IF char_length(b) > 20000 THEN RAISE EXCEPTION 'Le message est trop long.'; END IF;

  SELECT count(*) INTO recent FROM public.forum_posts
    WHERE author_id = caller AND created_at > now() - interval '10 minutes';
  IF recent >= 20 THEN RAISE EXCEPTION 'Trop de messages envoyés récemment. Réessaie plus tard.'; END IF;
  IF EXISTS (SELECT 1 FROM public.forum_posts
      WHERE author_id = caller AND topic_id = _topic AND body = b
        AND created_at > now() - interval '2 minutes') THEN
    RAISE EXCEPTION 'Message en double détecté.';
  END IF;

  IF _reply_to IS NOT NULL THEN
    SELECT author_id INTO rt_author FROM public.forum_posts
      WHERE id = _reply_to AND topic_id = _topic AND deleted_at IS NULL;
    IF rt_author IS NULL THEN RAISE EXCEPTION 'Message cité introuvable.'; END IF;
  END IF;

  INSERT INTO public.forum_posts (topic_id, author_id, body, reply_to_id)
  VALUES (_topic, caller, b, _reply_to)
  RETURNING id INTO new_id;

  UPDATE public.forum_topics
    SET reply_count = reply_count + 1, last_activity_at = now(), updated_at = now()
    WHERE id = _topic;

  IF t_author IS NOT NULL AND t_author <> caller THEN
    PERFORM public.forum_notify(
      t_author, 'forum_reply', 'forumreply:' || new_id::text,
      'Nouvelle réponse à ton sujet', left(b, 140),
      '/communaute/t/' || _topic::text);
  END IF;
  IF rt_author IS NOT NULL AND rt_author <> caller AND rt_author <> t_author THEN
    PERFORM public.forum_notify(
      rt_author, 'forum_mention', 'forummention:' || new_id::text,
      'Quelqu''un t''a répondu', left(b, 140),
      '/communaute/t/' || _topic::text);
  END IF;

  RETURN new_id;
END;$$;

-- ---------------------------------------------------------------------------
-- edit_forum_topic (author only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.edit_forum_topic(
  _id uuid, _title text, _body text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  a_author uuid; a_deleted timestamptz;
  t text := trim(coalesce(_title, ''));
  b text := trim(coalesce(_body, ''));
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT author_id, deleted_at INTO a_author, a_deleted FROM public.forum_topics WHERE id = _id;
  IF a_author IS NULL THEN RAISE EXCEPTION 'Sujet introuvable.'; END IF;
  IF a_author <> caller THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  IF a_deleted IS NOT NULL THEN RAISE EXCEPTION 'Sujet supprimé.'; END IF;
  IF char_length(t) < 3 OR char_length(t) > 160 THEN RAISE EXCEPTION 'Titre invalide.'; END IF;
  IF char_length(b) < 1 OR char_length(b) > 20000 THEN RAISE EXCEPTION 'Message invalide.'; END IF;
  UPDATE public.forum_topics SET title = left(t, 160), body = b, updated_at = now() WHERE id = _id;
END;$$;

-- ---------------------------------------------------------------------------
-- edit_forum_post (author only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.edit_forum_post(
  _id uuid, _body text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  a_author uuid; a_deleted timestamptz;
  b text := trim(coalesce(_body, ''));
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT author_id, deleted_at INTO a_author, a_deleted FROM public.forum_posts WHERE id = _id;
  IF a_author IS NULL THEN RAISE EXCEPTION 'Message introuvable.'; END IF;
  IF a_author <> caller THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  IF a_deleted IS NOT NULL THEN RAISE EXCEPTION 'Message supprimé.'; END IF;
  IF char_length(b) < 1 OR char_length(b) > 20000 THEN RAISE EXCEPTION 'Message invalide.'; END IF;
  UPDATE public.forum_posts SET body = b, updated_at = now() WHERE id = _id;
END;$$;

-- ---------------------------------------------------------------------------
-- delete_forum_topic (author or moderator, soft)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_forum_topic(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); a_author uuid; a_deleted timestamptz; ismod boolean;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT author_id, deleted_at INTO a_author, a_deleted FROM public.forum_topics WHERE id = _id;
  IF a_author IS NULL THEN RAISE EXCEPTION 'Sujet introuvable.'; END IF;
  ismod := public.can_moderate_now(caller);
  IF a_author <> caller AND NOT ismod THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  IF a_deleted IS NOT NULL THEN RETURN; END IF;
  UPDATE public.forum_topics
    SET deleted_at = now(), deleted_by = caller, updated_at = now()
    WHERE id = _id;
END;$$;

-- ---------------------------------------------------------------------------
-- delete_forum_post (author or moderator, soft + recount)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_forum_post(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); a_author uuid; a_deleted timestamptz; a_topic uuid; ismod boolean;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT author_id, deleted_at, topic_id INTO a_author, a_deleted, a_topic FROM public.forum_posts WHERE id = _id;
  IF a_author IS NULL THEN RAISE EXCEPTION 'Message introuvable.'; END IF;
  ismod := public.can_moderate_now(caller);
  IF a_author <> caller AND NOT ismod THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  IF a_deleted IS NOT NULL THEN RETURN; END IF;
  UPDATE public.forum_posts
    SET deleted_at = now(), deleted_by = caller, updated_at = now()
    WHERE id = _id;
  UPDATE public.forum_topics SET reply_count = (
    SELECT count(*) FROM public.forum_posts p
    WHERE p.topic_id = a_topic AND p.deleted_at IS NULL AND p.hidden_at IS NULL
  ) WHERE id = a_topic;
END;$$;

-- ---------------------------------------------------------------------------
-- moderate_forum (moderator only) — hide/unhide/soft_delete/restore
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.moderate_forum(
  _target_type text, _target_id uuid, _action text, _note text DEFAULT ''
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); aff uuid; tid uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT public.can_moderate_now(caller) THEN RAISE EXCEPTION 'Insufficient privileges.'; END IF;
  IF _action NOT IN ('hide','unhide','soft_delete','restore') THEN
    RAISE EXCEPTION 'Action non supportée.'; END IF;

  IF _target_type = 'topic' THEN
    UPDATE public.forum_topics SET
      hidden_at  = CASE WHEN _action='hide' THEN now() WHEN _action='unhide' THEN NULL ELSE hidden_at END,
      hidden_by  = CASE WHEN _action='hide' THEN caller WHEN _action='unhide' THEN NULL ELSE hidden_by END,
      deleted_at = CASE WHEN _action='soft_delete' THEN now() WHEN _action='restore' THEN NULL ELSE deleted_at END,
      deleted_by = CASE WHEN _action='soft_delete' THEN caller WHEN _action='restore' THEN NULL ELSE deleted_by END,
      updated_at = now()
    WHERE id = _target_id
    RETURNING author_id INTO aff;
    IF aff IS NULL THEN RAISE EXCEPTION 'Contenu introuvable.'; END IF;
    IF _action IN ('hide','soft_delete') AND aff <> caller THEN
      PERFORM public.forum_notify(aff, 'forum_moderation',
        'forummod:' || _target_id::text || ':' || _action,
        'Contenu modéré', 'Ton sujet a été modéré par l''équipe KAZEN.', '/communaute');
    END IF;

  ELSIF _target_type = 'post' THEN
    UPDATE public.forum_posts SET
      hidden_at  = CASE WHEN _action='hide' THEN now() WHEN _action='unhide' THEN NULL ELSE hidden_at END,
      hidden_by  = CASE WHEN _action='hide' THEN caller WHEN _action='unhide' THEN NULL ELSE hidden_by END,
      deleted_at = CASE WHEN _action='soft_delete' THEN now() WHEN _action='restore' THEN NULL ELSE deleted_at END,
      deleted_by = CASE WHEN _action='soft_delete' THEN caller WHEN _action='restore' THEN NULL ELSE deleted_by END,
      updated_at = now()
    WHERE id = _target_id
    RETURNING author_id, topic_id INTO aff, tid;
    IF aff IS NULL THEN RAISE EXCEPTION 'Contenu introuvable.'; END IF;
    UPDATE public.forum_topics SET reply_count = (
      SELECT count(*) FROM public.forum_posts p
      WHERE p.topic_id = tid AND p.deleted_at IS NULL AND p.hidden_at IS NULL
    ) WHERE id = tid;
    IF _action IN ('hide','soft_delete') AND aff <> caller THEN
      PERFORM public.forum_notify(aff, 'forum_moderation',
        'forummod:' || _target_id::text || ':' || _action,
        'Contenu modéré', 'Ton message a été modéré par l''équipe KAZEN.',
        '/communaute/t/' || tid::text);
    END IF;
  ELSE
    RAISE EXCEPTION 'Type invalide.';
  END IF;
END;$$;

-- ---------------------------------------------------------------------------
-- submit_forum_report (member)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_forum_report(
  _target_type text, _target_id uuid, _reason text, _details text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reporter uuid := auth.uid(); new_id uuid; target_exists boolean;
BEGIN
  IF reporter IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF _reason IS NULL OR char_length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'Un motif est requis.'; END IF;
  IF _target_type NOT IN ('topic','post') THEN RAISE EXCEPTION 'Type invalide.'; END IF;
  target_exists := CASE _target_type
    WHEN 'topic' THEN EXISTS (SELECT 1 FROM public.forum_topics WHERE id = _target_id AND deleted_at IS NULL)
    WHEN 'post'  THEN EXISTS (SELECT 1 FROM public.forum_posts  WHERE id = _target_id AND deleted_at IS NULL)
    ELSE false END;
  IF NOT target_exists THEN RAISE EXCEPTION 'Contenu introuvable.'; END IF;

  INSERT INTO public.forum_reports (target_type, target_id, reporter_id, reason, details)
  VALUES (_target_type, _target_id, reporter, left(_reason, 200), left(coalesce(_details, ''), 2000))
  ON CONFLICT (reporter_id, target_type, target_id) WHERE status IN ('pending','reviewing')
  DO UPDATE SET reason = EXCLUDED.reason, details = EXCLUDED.details, updated_at = now()
  RETURNING id INTO new_id;
  RETURN new_id;
END;$$;

-- ---------------------------------------------------------------------------
-- resolve_forum_report (moderator only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_forum_report(
  _id uuid, _status text, _note text DEFAULT ''
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT public.can_moderate_now(caller) THEN RAISE EXCEPTION 'Insufficient privileges.'; END IF;
  IF _status NOT IN ('pending','reviewing','dismissed','action_taken') THEN RAISE EXCEPTION 'Statut invalide.'; END IF;
  UPDATE public.forum_reports SET
    status = _status,
    resolved_by = CASE WHEN _status IN ('dismissed','action_taken') THEN caller ELSE resolved_by END,
    resolved_at = CASE WHEN _status IN ('dismissed','action_taken') THEN now() ELSE resolved_at END,
    resolution_note = coalesce(_note, ''),
    updated_at = now()
  WHERE id = _id;
END;$$;

-- ---------------------------------------------------------------------------
-- manage_forum_category (owner only) — additive upsert for future management
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manage_forum_category(
  _id uuid, _slug text, _name text, _description text,
  _icon text, _sort_order integer, _is_locked boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); new_id uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT public.has_role(caller, 'owner') THEN RAISE EXCEPTION 'Only the owner can manage categories.'; END IF;
  IF _slug IS NULL OR char_length(trim(_slug)) = 0 THEN RAISE EXCEPTION 'Slug requis.'; END IF;
  IF _name IS NULL OR char_length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Nom requis.'; END IF;

  IF _id IS NULL THEN
    INSERT INTO public.forum_categories (slug, name, description, icon, sort_order, is_locked)
    VALUES (lower(trim(_slug)), trim(_name), coalesce(_description, ''),
            coalesce(nullif(trim(_icon), ''), 'MessageSquare'),
            coalesce(_sort_order, 100), coalesce(_is_locked, false))
    RETURNING id INTO new_id;
  ELSE
    UPDATE public.forum_categories SET
      slug = lower(trim(_slug)), name = trim(_name),
      description = coalesce(_description, ''),
      icon = coalesce(nullif(trim(_icon), ''), 'MessageSquare'),
      sort_order = coalesce(_sort_order, 100),
      is_locked = coalesce(_is_locked, false),
      updated_at = now()
    WHERE id = _id
    RETURNING id INTO new_id;
    IF new_id IS NULL THEN RAISE EXCEPTION 'Catégorie introuvable.'; END IF;
  END IF;
  RETURN new_id;
END;$$;

-- ---------------------------------------------------------------------------
-- Seed initial categories
-- ---------------------------------------------------------------------------
INSERT INTO public.forum_categories (slug, name, description, icon, sort_order) VALUES
  ('general', 'Discussion générale', 'Parlez de tout ce qui touche à l''anime, aux séries et aux films.', 'MessagesSquare', 10),
  ('anime', 'Anime', 'Débats, recommandations et actualités autour de l''animation japonaise.', 'Sparkles', 20),
  ('series-films', 'Séries & Films', 'Vos avis et découvertes côté séries et cinéma.', 'Clapperboard', 30),
  ('recommandations', 'Recommandations', 'Demandez et partagez des recommandations personnalisées.', 'Compass', 40),
  ('meta', 'KAZEN & suggestions', 'Retours, idées et questions sur la plateforme KAZEN.', 'MessageSquare', 50)
ON CONFLICT (slug) DO NOTHING;
