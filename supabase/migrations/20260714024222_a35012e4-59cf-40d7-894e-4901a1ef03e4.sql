
-- 1. Settings: cache controls (additive) -----------------------------------
ALTER TABLE public.ai_assistant_settings
  ADD COLUMN IF NOT EXISTS cache_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cache_ttl_minutes integer NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS catalogue_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cache_hit_daily_limit integer NOT NULL DEFAULT 100;

-- 2. Cache store: server-only, no client grants ----------------------------
CREATE TABLE IF NOT EXISTS public.ai_assistant_cache (
  cache_key text PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready')),
  response_text text,
  model_id text NOT NULL,
  prompt_version integer NOT NULL,
  catalogue_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  lock_expires_at timestamptz,
  hit_count integer NOT NULL DEFAULT 0,
  last_hit_at timestamptz
);

-- Only service_role (trusted server code) may touch the cache. No anon /
-- authenticated grants: members cannot read, enumerate, insert or alter it.
GRANT ALL ON public.ai_assistant_cache TO service_role;
ALTER TABLE public.ai_assistant_cache ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: RLS denies all non-service_role access.

CREATE INDEX IF NOT EXISTS ai_assistant_cache_expires_idx
  ON public.ai_assistant_cache (expires_at);

-- 3. Atomic hit / lock acquisition (in-flight dedup) -----------------------
CREATE OR REPLACE FUNCTION public.ai_assistant_cache_try(
  _cache_key text, _model_id text, _prompt_version integer,
  _catalogue_version integer, _ttl_minutes integer, _lock_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r public.ai_assistant_cache;
BEGIN
  SELECT * INTO r FROM public.ai_assistant_cache
    WHERE cache_key = _cache_key FOR UPDATE;

  IF FOUND THEN
    IF r.status = 'ready' AND r.expires_at > now()
       AND r.model_id = _model_id
       AND r.prompt_version = _prompt_version
       AND r.catalogue_version = _catalogue_version
       AND r.response_text IS NOT NULL AND length(r.response_text) > 0 THEN
      UPDATE public.ai_assistant_cache
        SET hit_count = hit_count + 1, last_hit_at = now()
        WHERE cache_key = _cache_key;
      RETURN jsonb_build_object('state','hit','response_text', r.response_text);
    END IF;

    IF r.status = 'pending' AND r.lock_expires_at IS NOT NULL
       AND r.lock_expires_at > now() THEN
      RETURN jsonb_build_object('state','inflight');
    END IF;

    -- Stale / expired / version mismatch: take over the lock.
    UPDATE public.ai_assistant_cache SET
      status = 'pending', response_text = NULL,
      model_id = _model_id, prompt_version = _prompt_version,
      catalogue_version = _catalogue_version, created_at = now(),
      expires_at = now() + make_interval(mins => _ttl_minutes),
      lock_expires_at = now() + make_interval(secs => _lock_seconds),
      hit_count = 0, last_hit_at = NULL
      WHERE cache_key = _cache_key;
    RETURN jsonb_build_object('state','acquired');
  END IF;

  INSERT INTO public.ai_assistant_cache
    (cache_key, status, model_id, prompt_version, catalogue_version,
     expires_at, lock_expires_at)
    VALUES (_cache_key, 'pending', _model_id, _prompt_version, _catalogue_version,
     now() + make_interval(mins => _ttl_minutes),
     now() + make_interval(secs => _lock_seconds));
  RETURN jsonb_build_object('state','acquired');
END;
$$;

-- 4. Read-only poll for in-flight waiters ----------------------------------
CREATE OR REPLACE FUNCTION public.ai_assistant_cache_poll(
  _cache_key text, _model_id text, _prompt_version integer,
  _catalogue_version integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r public.ai_assistant_cache;
BEGIN
  SELECT * INTO r FROM public.ai_assistant_cache WHERE cache_key = _cache_key;
  IF FOUND AND r.status = 'ready' AND r.expires_at > now()
     AND r.model_id = _model_id AND r.prompt_version = _prompt_version
     AND r.catalogue_version = _catalogue_version
     AND r.response_text IS NOT NULL AND length(r.response_text) > 0 THEN
    UPDATE public.ai_assistant_cache
      SET hit_count = hit_count + 1, last_hit_at = now()
      WHERE cache_key = _cache_key;
    RETURN jsonb_build_object('state','hit','response_text', r.response_text);
  END IF;
  RETURN jsonb_build_object('state','pending');
END;
$$;

-- 5. Store a completed response (only over our pending lock) ----------------
CREATE OR REPLACE FUNCTION public.ai_assistant_cache_store(
  _cache_key text, _response_text text, _ttl_minutes integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _response_text IS NULL OR length(_response_text) = 0 THEN RETURN; END IF;
  UPDATE public.ai_assistant_cache SET
    status = 'ready', response_text = _response_text,
    expires_at = now() + make_interval(mins => _ttl_minutes),
    lock_expires_at = NULL
    WHERE cache_key = _cache_key AND status = 'pending';
END;
$$;

-- 6. Release a lock on failure / abort -------------------------------------
CREATE OR REPLACE FUNCTION public.ai_assistant_cache_release(_cache_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.ai_assistant_cache
    WHERE cache_key = _cache_key AND status = 'pending';
END;
$$;

-- 7. Log a cache hit (separate anti-abuse limit, no paid quota) -------------
CREATE OR REPLACE FUNCTION public.ai_assistant_cache_reserve(
  _user_id uuid, _request_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s public.ai_assistant_settings;
  day_start timestamptz := date_trunc('day', now());
  hits_today integer;
  new_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'auth');
  END IF;
  SELECT * INTO s FROM public.ai_assistant_settings WHERE id = 1;
  IF NOT FOUND OR NOT s.enabled THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'disabled');
  END IF;

  -- Separate anti-abuse rate limit for free cache hits.
  SELECT count(*) INTO hits_today FROM public.ai_assistant_usage
    WHERE user_id = _user_id AND requested_at >= day_start AND cached = true;
  IF hits_today >= s.cache_hit_daily_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'cache_rate');
  END IF;

  INSERT INTO public.ai_assistant_usage (user_id, request_key, status, cached)
    VALUES (_user_id, _request_key, 'cached', true)
    RETURNING id INTO new_id;
  RETURN jsonb_build_object('allowed', true, 'usage_id', new_id);
END;
$$;

-- 8. Paid reserve: exclude cache hits from the global paid breaker ----------
CREATE OR REPLACE FUNCTION public.ai_assistant_reserve(_request_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.ai_assistant_settings;
  is_owner boolean;
  is_new boolean;
  created timestamptz;
  day_start timestamptz := date_trunc('day', now());
  month_start timestamptz := date_trunc('month', now());
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

  -- Global circuit breaker for PAID calls only (cache hits excluded).
  IF NOT is_owner THEN
    SELECT count(*) INTO global_today FROM public.ai_assistant_usage
      WHERE requested_at >= day_start AND status IN ('pending','success');
    SELECT count(*) INTO global_month FROM public.ai_assistant_usage
      WHERE requested_at >= month_start AND status IN ('pending','success');
    IF global_today >= s.global_daily_limit OR global_month >= s.global_monthly_limit THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'global');
    END IF;
  END IF;

  SELECT created_at INTO created FROM auth.users WHERE id = uid;
  is_new := created IS NOT NULL
            AND created > now() - make_interval(days => s.new_account_window_days);

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

-- 9. Owner settings patch: include cache controls --------------------------
CREATE OR REPLACE FUNCTION public.ai_assistant_update_settings(_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'owner') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.ai_assistant_settings SET
    enabled               = coalesce((_patch->>'enabled')::boolean, enabled),
    daily_user_limit      = coalesce((_patch->>'daily_user_limit')::integer, daily_user_limit),
    monthly_user_limit    = coalesce((_patch->>'monthly_user_limit')::integer, monthly_user_limit),
    global_daily_limit    = coalesce((_patch->>'global_daily_limit')::integer, global_daily_limit),
    global_monthly_limit  = coalesce((_patch->>'global_monthly_limit')::integer, global_monthly_limit),
    cache_enabled         = coalesce((_patch->>'cache_enabled')::boolean, cache_enabled),
    cache_ttl_minutes     = coalesce((_patch->>'cache_ttl_minutes')::integer, cache_ttl_minutes),
    catalogue_version     = coalesce((_patch->>'catalogue_version')::integer, catalogue_version),
    cache_hit_daily_limit = coalesce((_patch->>'cache_hit_daily_limit')::integer, cache_hit_daily_limit),
    updated_at            = now(),
    updated_by            = uid
    WHERE id = 1;
  RETURN public.ai_assistant_admin_stats();
END;
$$;

-- 10. Admin stats: truthful cache diagnostics ------------------------------
CREATE OR REPLACE FUNCTION public.ai_assistant_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
    'cache_enabled', s.cache_enabled,
    'cache_ttl_minutes', s.cache_ttl_minutes,
    'catalogue_version', s.catalogue_version,
    'cache_hit_daily_limit', s.cache_hit_daily_limit,
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
    'cached_month', (SELECT count(*) FROM public.ai_assistant_usage
      WHERE requested_at >= month_start AND cached = true),
    'model_calls_month', (SELECT count(*) FROM public.ai_assistant_usage
      WHERE requested_at >= month_start AND status = 'success'),
    'active_cache_entries', (SELECT count(*) FROM public.ai_assistant_cache
      WHERE status = 'ready' AND expires_at > now()),
    'expired_cache_entries', (SELECT count(*) FROM public.ai_assistant_cache
      WHERE expires_at <= now()),
    'active_members_month', (SELECT count(DISTINCT user_id) FROM public.ai_assistant_usage
      WHERE requested_at >= month_start),
    'input_tokens_month', (SELECT coalesce(sum(input_tokens),0) FROM public.ai_assistant_usage
      WHERE requested_at >= month_start),
    'output_tokens_month', (SELECT coalesce(sum(output_tokens),0) FROM public.ai_assistant_usage
      WHERE requested_at >= month_start)
  );
END;
$$;

-- 11. Lock cache internals to trusted server code only ---------------------
REVOKE ALL ON FUNCTION public.ai_assistant_cache_try(text,text,integer,integer,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_assistant_cache_poll(text,text,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_assistant_cache_store(text,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_assistant_cache_release(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_assistant_cache_reserve(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_assistant_cache_try(text,text,integer,integer,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_assistant_cache_poll(text,text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_assistant_cache_store(text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_assistant_cache_release(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_assistant_cache_reserve(uuid,text) TO service_role;
