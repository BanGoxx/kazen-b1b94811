REVOKE EXECUTE ON FUNCTION public.anilist_cache_get(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.anilist_cache_put(text, jsonb) FROM anon, authenticated, PUBLIC;