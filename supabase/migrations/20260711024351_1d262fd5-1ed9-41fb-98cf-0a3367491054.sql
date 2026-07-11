
-- Media records: remove direct client writes (writes now go through server functions using service role)
DROP POLICY IF EXISTS "Authenticated users can add media records" ON public.media_records;
DROP POLICY IF EXISTS "Authenticated users can refresh media records" ON public.media_records;
REVOKE INSERT, UPDATE ON public.media_records FROM authenticated;

-- Lock down SECURITY DEFINER signup helper (trigger still fires regardless of EXECUTE grants)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
