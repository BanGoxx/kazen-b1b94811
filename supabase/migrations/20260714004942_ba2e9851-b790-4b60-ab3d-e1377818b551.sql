-- Replace the view-based approach with column-level privileges (linter-clean).

-- 0) Remove the previously created definer view.
DROP VIEW IF EXISTS public.profiles_public;

-- 1) Rows remain readable by everyone; column privileges (step 2) decide which columns.
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

-- 2) Column-level SELECT: expose only the public-safe columns to anon + authenticated.
--    Sensitive columns (preferred_genres/types, favorite_styles, accepts_chat, updated_at)
--    are no longer directly selectable via the Data API.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, display_name, avatar_url, bio, created_at)
  ON public.profiles TO anon, authenticated;
-- service_role keeps full access.
GRANT ALL ON public.profiles TO service_role;

-- 3) Owner reads their own FULL profile through a security-definer RPC
--    (bypasses the column restriction for the owner's own row only).
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;