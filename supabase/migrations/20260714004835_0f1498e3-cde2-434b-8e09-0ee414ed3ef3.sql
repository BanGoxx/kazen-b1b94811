-- Restrict direct reads of the profiles base table to the owner only,
-- and expose a safe public subset (id, display_name, avatar_url, bio) via a view.
-- This closes anonymous harvesting of taste-preference arrays and the accepts_chat flag
-- while preserving display names, avatars, and author lookups everywhere.

-- 1) Replace the world-readable SELECT policy with an owner-only one.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 2) Public-safe view. Runs with the view owner's privileges (security definer semantics),
--    so it exposes ONLY these columns to everyone (anon + authenticated), independent of the
--    now owner-only base-table RLS. No sensitive columns are selected.
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
  SELECT id, display_name, avatar_url, bio, created_at
  FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;