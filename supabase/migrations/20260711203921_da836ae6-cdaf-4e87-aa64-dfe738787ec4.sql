DROP POLICY IF EXISTS "Signed-in users can update media snapshots" ON public.media_records;

CREATE POLICY "Signed-in users can update media snapshots"
ON public.media_records
FOR UPDATE
TO authenticated
USING (
  media_key IS NOT NULL
  AND length(media_key) BETWEEN 3 AND 128
  AND source IN ('anilist', 'tmdb')
  AND media_type IN ('anime', 'movie', 'series')
  AND title IS NOT NULL
  AND length(trim(title)) > 0
  AND length(title) <= 300
  AND (score IS NULL OR (score >= 0 AND score <= 100))
)
WITH CHECK (
  media_key IS NOT NULL
  AND length(media_key) BETWEEN 3 AND 128
  AND source IN ('anilist', 'tmdb')
  AND media_type IN ('anime', 'movie', 'series')
  AND title IS NOT NULL
  AND length(trim(title)) > 0
  AND length(title) <= 300
  AND (score IS NULL OR (score >= 0 AND score <= 100))
);