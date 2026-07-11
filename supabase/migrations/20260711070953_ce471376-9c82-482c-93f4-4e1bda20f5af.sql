CREATE TABLE public.anilist_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.anilist_cache TO service_role;

ALTER TABLE public.anilist_cache ENABLE ROW LEVEL SECURITY;
-- No policies: only the server (service_role, which bypasses RLS) reads/writes
-- this cache. anon and authenticated have no access.