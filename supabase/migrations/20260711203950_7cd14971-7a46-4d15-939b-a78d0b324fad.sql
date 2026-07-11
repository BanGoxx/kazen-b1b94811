DROP POLICY IF EXISTS "No direct client access to AniList cache" ON public.anilist_cache;

CREATE POLICY "No direct client access to AniList cache"
ON public.anilist_cache
FOR ALL
TO public
USING (false)
WITH CHECK (false);