-- ============ Phase C: Moderation spine ============

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM ('pending','reviewing','dismissed','action_taken');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.moderation_action_type AS ENUM
    ('hide','unhide','soft_delete','restore','lock','unlock','warn','timeout','dismiss_report');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.moderation_target_type AS ENUM
    ('review','reply','playlist','playlist_item');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Reversible moderation columns on existing content
ALTER TABLE public.fiche_reviews
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.review_replies
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.playlists
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.playlist_items
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- 3. Role helper: moderator or higher
CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner','admin','moderator')
  );
$$;

-- 4. content_reports
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type public.moderation_target_type NOT NULL,
  target_id uuid NOT NULL,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  status public.report_status NOT NULL DEFAULT 'pending',
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- prevent duplicate open reports by the same reporter on the same target
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_unique_open
  ON public.content_reports (reporter_id, target_type, target_id)
  WHERE status IN ('pending','reviewing');

CREATE INDEX IF NOT EXISTS content_reports_target_idx
  ON public.content_reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS content_reports_status_idx
  ON public.content_reports (status);

GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters read own, moderators read all"
  ON public.content_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.is_moderator(auth.uid()));

CREATE POLICY "Members can submit reports"
  ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND char_length(reason) BETWEEN 1 AND 200
    AND char_length(details) <= 2000
    AND status = 'pending'
    AND resolved_by IS NULL
    AND resolved_at IS NULL
  );

CREATE POLICY "Moderators can update report status"
  ON public.content_reports FOR UPDATE TO authenticated
  USING (public.is_moderator(auth.uid()))
  WITH CHECK (public.is_moderator(auth.uid()));

-- keep updated_at fresh
CREATE TRIGGER update_content_reports_updated_at
  BEFORE UPDATE ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. moderation_actions (append-only audit log)
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.moderation_target_type NOT NULL,
  target_id uuid NOT NULL,
  action public.moderation_action_type NOT NULL,
  reason text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  report_id uuid REFERENCES public.content_reports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_actions_target_idx
  ON public.moderation_actions (target_type, target_id);
CREATE INDEX IF NOT EXISTS moderation_actions_actor_idx
  ON public.moderation_actions (actor_id);

-- No INSERT/UPDATE/DELETE grants to authenticated: writes go only through
-- SECURITY DEFINER functions, keeping the log append-only and audit-safe.
GRANT SELECT ON public.moderation_actions TO authenticated;
GRANT ALL ON public.moderation_actions TO service_role;

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderators can read the audit log"
  ON public.moderation_actions FOR SELECT TO authenticated
  USING (public.is_moderator(auth.uid()));

-- 6. Submit report (member-facing, controlled)
CREATE OR REPLACE FUNCTION public.submit_content_report(
  _target_type public.moderation_target_type,
  _target_id uuid,
  _reason text,
  _details text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- validate the target exists
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

  INSERT INTO public.content_reports (target_type, target_id, reporter_id, reason, details)
  VALUES (_target_type, _target_id, reporter, left(_reason, 200), left(COALESCE(_details,''), 2000))
  ON CONFLICT (reporter_id, target_type, target_id) WHERE status IN ('pending','reviewing')
  DO UPDATE SET reason = EXCLUDED.reason, details = EXCLUDED.details, updated_at = now()
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- 7. Moderate content (elevated roles): hide/unhide/soft_delete/restore + audit
CREATE OR REPLACE FUNCTION public.moderate_content(
  _target_type public.moderation_target_type,
  _target_id uuid,
  _action public.moderation_action_type,
  _reason text DEFAULT '',
  _note text DEFAULT '',
  _report_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF NOT public.is_moderator(actor) THEN
    RAISE EXCEPTION 'Insufficient privileges to moderate content.';
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

  -- Append audit entry
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
$$;

-- 8. Resolve a report without a content action (e.g. dismiss)
CREATE OR REPLACE FUNCTION public.resolve_report(
  _report_id uuid,
  _status public.report_status,
  _note text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF NOT public.is_moderator(actor) THEN
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
$$;

-- 9. Update public SELECT policies to hide moderated content from normal users,
--    while preserving full visibility for moderators/admins/owner (audit).

-- Reviews
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.fiche_reviews;
CREATE POLICY "Anyone can read visible reviews"
  ON public.fiche_reviews FOR SELECT TO public
  USING (
    (hidden_at IS NULL AND deleted_at IS NULL)
    OR auth.uid() = user_id
    OR public.is_moderator(auth.uid())
  );

-- Replies
DROP POLICY IF EXISTS "Replies are publicly readable" ON public.review_replies;
CREATE POLICY "Visible replies are publicly readable"
  ON public.review_replies FOR SELECT TO public
  USING (
    (hidden_at IS NULL AND deleted_at IS NULL)
    OR auth.uid() = user_id
    OR public.is_moderator(auth.uid())
  );

-- Playlists
DROP POLICY IF EXISTS "Public playlists are readable by everyone" ON public.playlists;
CREATE POLICY "Visible public playlists are readable"
  ON public.playlists FOR SELECT TO public
  USING (
    ((is_public OR auth.uid() = owner_id) AND hidden_at IS NULL AND deleted_at IS NULL)
    OR auth.uid() = owner_id
    OR public.is_moderator(auth.uid())
  );

-- Playlist items
DROP POLICY IF EXISTS "Playlist items follow playlist visibility" ON public.playlist_items;
CREATE POLICY "Visible playlist items follow playlist visibility"
  ON public.playlist_items FOR SELECT TO public
  USING (
    (
      playlist_items.hidden_at IS NULL AND playlist_items.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.playlists p
        WHERE p.id = playlist_items.playlist_id
          AND (p.is_public OR p.owner_id = auth.uid())
          AND p.hidden_at IS NULL AND p.deleted_at IS NULL
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_items.playlist_id AND p.owner_id = auth.uid()
    )
    OR public.is_moderator(auth.uid())
  );
