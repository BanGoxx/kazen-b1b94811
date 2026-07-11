DROP FUNCTION IF EXISTS public.role_diag();

-- Recreate the writer with a mandatory server-only token. The Data API treats
-- our worker as the anon role (opaque key quirk), so a token is the only way to
-- keep writes server-exclusive: browsers/anon users never possess it.
DROP FUNCTION IF EXISTS public.anilist_cache_put(text, jsonb);

CREATE OR REPLACE FUNCTION public.anilist_cache_put(p_key text, p_payload jsonb, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL OR p_token <> '6ff6f2037d2ec98b100d1f3247f3127ce7a7bb5341216a02' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
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

GRANT EXECUTE ON FUNCTION public.anilist_cache_put(text, jsonb, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anilist_cache_get(text) TO anon, authenticated, service_role;