CREATE TABLE public.email_delivery_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  digest_type text NOT NULL CHECK (digest_type IN (
    'founder_test_general',
    'founder_test_personalized',
    'future_general',
    'future_personalized'
  )),
  provider text,
  provider_message_id text,
  recipient_masked text,
  recipient_hash text,
  subject text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  failure_code text,
  failure_message_safe text,
  content_version text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

GRANT SELECT ON public.email_delivery_logs TO authenticated;
GRANT ALL ON public.email_delivery_logs TO service_role;

ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Owner-only read; inserts/updates happen server-side via the service role
-- (which bypasses RLS), so no write policy is exposed to app roles.
CREATE POLICY "Owner can read email delivery logs"
ON public.email_delivery_logs
FOR SELECT
TO authenticated
USING (public.can_moderate_now(auth.uid()));

CREATE INDEX idx_email_delivery_logs_created_at
ON public.email_delivery_logs (created_at DESC);