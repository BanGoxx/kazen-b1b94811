-- Batch 1 (A2 + A5): additive-only notification enhancements.

-- A5: granular controls — quiet mode and snooze, kept separate from email consent.
ALTER TABLE public.member_notification_preferences
  ADD COLUMN IF NOT EXISTS quiet_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS snooze_until timestamptz;

-- A2: efficient expiry filtering for the inbox and reconciliation pruning.
CREATE INDEX IF NOT EXISTS idx_member_notifications_expiry
  ON public.member_notifications (user_id, expires_at)
  WHERE expires_at IS NOT NULL;