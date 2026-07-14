
-- Strip anonymous write access entirely (public catalogue is read-only for anon;
-- no policy ever allowed anon writes, this removes the redundant grant too).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.media_records FROM anon;

-- Remove table-wide write privileges from members so they can no longer target
-- arbitrary columns (notably the trusted episodes_count) via the Data API.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.media_records FROM authenticated;

-- Re-grant column-scoped write access to members for presentation/catalogue
-- snapshot fields ONLY. episodes_count is intentionally excluded, so a crafted
-- REST request that tries to set it fails with a column permission error.
GRANT INSERT (
  media_key, source, external_id, media_type, title, title_original,
  poster_url, backdrop_url, release_date, genres, platforms, score,
  created_at, updated_at
) ON public.media_records TO authenticated;

GRANT UPDATE (
  media_key, source, external_id, media_type, title, title_original,
  poster_url, backdrop_url, release_date, genres, platforms, score,
  created_at, updated_at
) ON public.media_records TO authenticated;

-- Ensure the trusted server role retains full authority (writes episodes_count).
GRANT ALL ON public.media_records TO service_role;
