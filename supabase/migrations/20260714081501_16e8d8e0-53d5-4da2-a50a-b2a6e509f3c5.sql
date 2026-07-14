-- Replace the overly-permissive SELECT policy on public.profiles.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Public profiles remain readable by anyone (signed-in or not).
CREATE POLICY "Public profiles are readable"
ON public.profiles
FOR SELECT
USING (profile_public IS TRUE);

-- Members can always read their own profile row, even if private.
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);