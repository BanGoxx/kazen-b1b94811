-- KAZEN Internal Notification Center — Phase 1 (additive, non-destructive)

-- 1) Notifications table (persisted read/dismiss state; deduped by event_key)
CREATE TABLE public.member_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN (
    'new_episode','upcoming_release','related_article','personalized_recommendation',
    'shared_list_request','shared_list_request_accepted','shared_list_request_declined','system_notice'
  )),
  event_key text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  destination_url text NOT NULL,
  media_source text,
  media_external_id text,
  article_slug text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  expires_at timestamptz,
  UNIQUE (user_id, event_key)
);

-- Users can only ever read their own rows. All writes are server-controlled
-- (service_role via server functions), so no INSERT/UPDATE/DELETE grant to
-- authenticated — this prevents any client from forging notifications.
GRANT SELECT ON public.member_notifications TO authenticated;
GRANT ALL ON public.member_notifications TO service_role;

ALTER TABLE public.member_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their own notifications"
  ON public.member_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Efficient unread-count + ordered listing
CREATE INDEX idx_member_notifications_inbox
  ON public.member_notifications (user_id, dismissed_at, read_at, occurred_at DESC);
CREATE INDEX idx_member_notifications_occurred
  ON public.member_notifications (user_id, occurred_at DESC);

-- 2) Per-member notification preferences (independent from email preferences)
CREATE TABLE public.member_notification_preferences (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  new_episode_enabled boolean NOT NULL DEFAULT true,
  upcoming_release_enabled boolean NOT NULL DEFAULT true,
  related_article_enabled boolean NOT NULL DEFAULT true,
  recommendation_enabled boolean NOT NULL DEFAULT true,
  shared_list_enabled boolean NOT NULL DEFAULT true,
  system_notice_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.member_notification_preferences TO authenticated;
GRANT ALL ON public.member_notification_preferences TO service_role;

ALTER TABLE public.member_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage their own notification preferences"
  ON public.member_notification_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_member_notif_prefs_updated_at
  BEFORE UPDATE ON public.member_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Owner-only trusted system notice creator (client cannot forge system notices).
--    Targets a single user (default = the caller) to avoid mass writes in Phase 1.
CREATE OR REPLACE FUNCTION public.create_system_notice(
  _title text,
  _message text,
  _destination_url text DEFAULT '/notifications',
  _target uuid DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  target uuid := COALESCE(_target, auth.uid());
  new_id uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF NOT public.has_role(caller, 'owner') THEN
    RAISE EXCEPTION 'Only the owner can create system notices.';
  END IF;
  IF _title IS NULL OR char_length(trim(_title)) = 0
     OR _message IS NULL OR char_length(trim(_message)) = 0 THEN
    RAISE EXCEPTION 'Title and message are required.';
  END IF;

  INSERT INTO public.member_notifications
    (user_id, notification_type, event_key, title, message, destination_url, occurred_at, expires_at, metadata)
  VALUES
    (target, 'system_notice',
     'system:' || gen_random_uuid()::text,
     left(_title, 160), left(_message, 500),
     COALESCE(NULLIF(trim(_destination_url), ''), '/notifications'),
     now(), _expires_at, jsonb_build_object('created_by', caller))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;