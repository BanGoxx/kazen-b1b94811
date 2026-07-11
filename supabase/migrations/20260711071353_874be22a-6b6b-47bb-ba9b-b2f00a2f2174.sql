CREATE OR REPLACE FUNCTION public.anilist_cache_get(p_key text)
RETURNS TABLE(payload jsonb, fetched_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT payload, fetched_at FROM public.anilist_cache WHERE cache_key = p_key;
$$;

CREATE OR REPLACE FUNCTION public.anilist_cache_put(p_key text, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Lightweight guards: keys are our short hashed identifiers, payloads are
  -- bounded, so a public caller cannot bloat or abuse the cache table.
  IF length(p_key) > 64 OR left(p_key, 3) <> 'al_' THEN
    RAISE EXCEPTION 'invalid cache key';
  END IF;
  IF pg_column_size(p_payload) > 2000000 THEN
    RAISE EXCEPTION 'cache payload too large';
  END IF;

  INSERT INTO public.anilist_cache (cache_key, payload, fetched_at)
  VALUES (p_key, p_payload, now())
  ON CONFLICT (cache_key)
  DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.anilist_cache_get(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anilist_cache_put(text, jsonb) TO anon, authenticated, service_role;