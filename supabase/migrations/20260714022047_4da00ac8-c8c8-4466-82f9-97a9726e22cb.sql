
-- ============================================================
-- KAZEN Phase 15 — AI assistant cost & abuse controls (additive)
-- ============================================================

-- 1) SETTINGS (single config row, Owner-managed) -------------
CREATE TABLE public.ai_assistant_settings (
  id                       integer PRIMARY KEY DEFAULT 1,
  enabled                  boolean NOT NULL DEFAULT true,
  daily_user_limit         integer NOT NULL DEFAULT 5,
  monthly_user_limit       integer NOT NULL DEFAULT 30,
  new_account_daily_limit  integer NOT NULL DEFAULT 2,
  new_account_window_limit integer NOT NULL DEFAULT 10,
  new_account_window_days  integer NOT NULL DEFAULT 7,
  owner_daily_limit        integer NOT NULL DEFAULT 200,
  global_daily_limit       integer NOT NULL DEFAULT 2000,
  global_monthly_limit     integer NOT NULL DEFAULT 30000,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid,
  CONSTRAINT ai_assistant_settings_singleton CHECK (id = 1)
);

GRANT SELECT ON public.ai_assistant_settings TO authenticated;
GRANT ALL ON public.ai_assistant_settings TO service_role;
ALTER TABLE public.ai_assistant_settings ENABLE ROW LEVEL SECURITY;

-- Only the Owner may read the raw settings (limits are otherwise surfaced via RPC).
CREATE POLICY "Owner reads assistant settings"
  ON public.ai_assistant_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

INSERT INTO public.ai_assistant_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- 2) USAGE (one minimal row per question) --------------------
CREATE TABLE public.ai_assistant_usage (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_key         text,
  requested_at        timestamptz NOT NULL DEFAULT now(),
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','success','failed','cached')),
  input_tokens        integer,
  output_tokens       integer,
  cached              boolean NOT NULL DEFAULT false,
  provider_error_code text
);

CREATE INDEX ai_assistant_usage_user_time_idx
  ON public.ai_assistant_usage (user_id, requested_at);
CREATE INDEX ai_assistant_usage_time_idx
  ON public.ai_assistant_usage (requested_at);

GRANT SELECT ON public.ai_assistant_usage TO authenticated;
GRANT ALL ON public.ai_assistant_usage TO service_role;
ALTER TABLE public.ai_assistant_usage ENABLE ROW LEVEL SECURITY;

-- Members can read only their own usage; no client writes (RPC/service only).
CREATE POLICY "Members read own assistant usage"
  ON public.ai_assistant_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3) RESERVE: check quota + record a pending call ------------
CREATE OR REPLACE FUNCTION public.ai_assistant_reserve(_request_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.ai_assistant_settings;
  is_owner boolean;
  is_new boolean;
  created timestamptz;
  day_start timestamptz := date_trunc('day', now());          -- UTC day
  month_start timestamptz := date_trunc('month', now());       -- UTC month
  window_start timestamptz;
  user_today integer;
  user_month integer;
  user_window integer;
  global_today integer;
  global_month integer;
  daily_cap integer;
  monthly_cap integer;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'auth');
  END IF;

  SELECT * INTO s FROM public.ai_assistant_settings WHERE id = 1;
  IF NOT FOUND OR NOT s.enabled THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'disabled');
  END IF;

  is_owner := public.has_role(uid, 'owner');

  -- Global circuit breaker (skip for Owner diagnostics).
  IF NOT is_owner THEN
    SELECT count(*) INTO global_today FROM public.ai_assistant_usage
      WHERE requested_at >= day_start AND status IN ('pending','success','cached');
    SELECT count(*) INTO global_month FROM public.ai_assistant_usage
      WHERE requested_at >= month_start AND status IN ('pending','success','cached');
    IF global_today >= s.global_daily_limit OR global_month >= s.global_monthly_limit THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'global');
    END IF;
  END IF;

  SELECT created_at INTO created FROM auth.users WHERE id = uid;
  is_new := created IS NOT NULL
            AND created > now() - make_interval(days => s.new_account_window_days);

  -- Per-member counts (pending + success count against quota; failed refunded).
  SELECT count(*) INTO user_today FROM public.ai_assistant_usage
    WHERE user_id = uid AND requested_at >= day_start AND status IN ('pending','success');
  SELECT count(*) INTO user_month FROM public.ai_assistant_usage
    WHERE user_id = uid AND requested_at >= month_start AND status IN ('pending','success');

  IF is_owner THEN
    daily_cap := s.owner_daily_limit;
    monthly_cap := s.owner_daily_limit * 31;
  ELSIF is_new THEN
    window_start := now() - make_interval(days => s.new_account_window_days);
    SELECT count(*) INTO user_window FROM public.ai_assistant_usage
      WHERE user_id = uid AND requested_at >= window_start AND status IN ('pending','success');
    daily_cap := s.new_account_daily_limit;
    monthly_cap := s.monthly_user_limit;
    IF user_window >= s.new_account_window_limit THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'new_account',
        'remaining_today', 0);
    END IF;
  ELSE
    daily_cap := s.daily_user_limit;
    monthly_cap := s.monthly_user_limit;
  END IF;

  IF user_today >= daily_cap THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'daily',
      'remaining_today', 0, 'remaining_month', greatest(monthly_cap - user_month, 0));
  END IF;
  IF user_month >= monthly_cap THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'monthly',
      'remaining_today', greatest(daily_cap - user_today, 0), 'remaining_month', 0);
  END IF;

  INSERT INTO public.ai_assistant_usage (user_id, request_key, status)
    VALUES (uid, _request_key, 'pending')
    RETURNING id INTO new_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'usage_id', new_id,
    'remaining_today', greatest(daily_cap - user_today - 1, 0),
    'remaining_month', greatest(monthly_cap - user_month - 1, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ai_assistant_reserve(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ai_assistant_reserve(text) TO authenticated, service_role;

-- 4) FINALIZE: mark a reserved call success/failed -----------
CREATE OR REPLACE FUNCTION public.ai_assistant_finalize(
  _usage_id uuid,
  _status text,
  _input_tokens integer DEFAULT NULL,
  _output_tokens integer DEFAULT NULL,
  _error_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  IF _status NOT IN ('success','failed','cached') THEN RETURN; END IF;
  UPDATE public.ai_assistant_usage
    SET status = _status,
        input_tokens = _input_tokens,
        output_tokens = _output_tokens,
        provider_error_code = _error_code,
        cached = (_status = 'cached')
    WHERE id = _usage_id AND user_id = uid AND status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.ai_assistant_finalize(uuid,text,integer,integer,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ai_assistant_finalize(uuid,text,integer,integer,text) TO authenticated, service_role;

-- 5) MY QUOTA: safe personal remaining view ------------------
CREATE OR REPLACE FUNCTION public.ai_assistant_my_quota()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.ai_assistant_settings;
  is_owner boolean;
  is_new boolean;
  created timestamptz;
  day_start timestamptz := date_trunc('day', now());
  month_start timestamptz := date_trunc('month', now());
  user_today integer;
  user_month integer;
  daily_cap integer;
  monthly_cap integer;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('enabled', false, 'authenticated', false);
  END IF;
  SELECT * INTO s FROM public.ai_assistant_settings WHERE id = 1;
  is_owner := public.has_role(uid, 'owner');
  SELECT created_at INTO created FROM auth.users WHERE id = uid;
  is_new := created IS NOT NULL
            AND created > now() - make_interval(days => s.new_account_window_days);

  SELECT count(*) INTO user_today FROM public.ai_assistant_usage
    WHERE user_id = uid AND requested_at >= day_start AND status IN ('pending','success');
  SELECT count(*) INTO user_month FROM public.ai_assistant_usage
    WHERE user_id = uid AND requested_at >= month_start AND status IN ('pending','success');

  IF is_owner THEN
    daily_cap := s.owner_daily_limit; monthly_cap := s.owner_daily_limit * 31;
  ELSIF is_new THEN
    daily_cap := s.new_account_daily_limit; monthly_cap := s.monthly_user_limit;
  ELSE
    daily_cap := s.daily_user_limit; monthly_cap := s.monthly_user_limit;
  END IF;

  RETURN jsonb_build_object(
    'enabled', s.enabled,
    'authenticated', true,
    'remaining_today', greatest(daily_cap - user_today, 0),
    'remaining_month', greatest(monthly_cap - user_month, 0),
    'daily_limit', daily_cap,
    'monthly_limit', monthly_cap
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ai_assistant_my_quota() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ai_assistant_my_quota() TO authenticated, service_role;

-- 6) OWNER: aggregate diagnostics ----------------------------
CREATE OR REPLACE FUNCTION public.ai_assistant_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.ai_assistant_settings;
  day_start timestamptz := date_trunc('day', now());
  month_start timestamptz := date_trunc('month', now());
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'owner') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT * INTO s FROM public.ai_assistant_settings WHERE id = 1;
  RETURN jsonb_build_object(
    'enabled', s.enabled,
    'daily_user_limit', s.daily_user_limit,
    'monthly_user_limit', s.monthly_user_limit,
    'global_daily_limit', s.global_daily_limit,
    'global_monthly_limit', s.global_monthly_limit,
    'questions_today', (SELECT count(*) FROM public.ai_assistant_usage
      WHERE requested_at >= day_start AND status IN ('success','pending','cached')),
    'questions_month', (SELECT count(*) FROM public.ai_assistant_usage
      WHERE requested_at >= month_start AND status IN ('success','pending','cached')),
    'success_today', (SELECT count(*) FROM public.ai_assistant_usage
      WHERE requested_at >= day_start AND status = 'success'),
    'failed_today', (SELECT count(*) FROM public.ai_assistant_usage
      WHERE requested_at >= day_start AND status = 'failed'),
    'cached_today', (SELECT count(*) FROM public.ai_assistant_usage
      WHERE requested_at >= day_start AND cached = true),
    'active_members_month', (SELECT count(DISTINCT user_id) FROM public.ai_assistant_usage
      WHERE requested_at >= month_start),
    'input_tokens_month', (SELECT coalesce(sum(input_tokens),0) FROM public.ai_assistant_usage
      WHERE requested_at >= month_start),
    'output_tokens_month', (SELECT coalesce(sum(output_tokens),0) FROM public.ai_assistant_usage
      WHERE requested_at >= month_start)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ai_assistant_admin_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ai_assistant_admin_stats() TO authenticated, service_role;

-- 7) OWNER: update settings / kill switch --------------------
CREATE OR REPLACE FUNCTION public.ai_assistant_update_settings(_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'owner') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.ai_assistant_settings SET
    enabled              = coalesce((_patch->>'enabled')::boolean, enabled),
    daily_user_limit     = coalesce((_patch->>'daily_user_limit')::integer, daily_user_limit),
    monthly_user_limit   = coalesce((_patch->>'monthly_user_limit')::integer, monthly_user_limit),
    global_daily_limit   = coalesce((_patch->>'global_daily_limit')::integer, global_daily_limit),
    global_monthly_limit = coalesce((_patch->>'global_monthly_limit')::integer, global_monthly_limit),
    updated_at           = now(),
    updated_by           = uid
    WHERE id = 1;
  RETURN public.ai_assistant_admin_stats();
END;
$$;

REVOKE ALL ON FUNCTION public.ai_assistant_update_settings(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ai_assistant_update_settings(jsonb) TO authenticated, service_role;
