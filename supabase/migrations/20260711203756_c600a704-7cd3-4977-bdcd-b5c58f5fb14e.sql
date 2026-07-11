CREATE OR REPLACE FUNCTION public.upsert_media_record_snapshot(
  p_media_key text,
  p_source text,
  p_external_id text,
  p_media_type text,
  p_title text,
  p_title_original text,
  p_poster_url text,
  p_backdrop_url text,
  p_release_date text,
  p_genres text[],
  p_platforms jsonb,
  p_score numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_media_key IS NULL OR length(p_media_key) < 3 OR length(p_media_key) > 128 THEN
    RAISE EXCEPTION 'invalid media key';
  END IF;

  IF p_source NOT IN ('anilist', 'tmdb') THEN
    RAISE EXCEPTION 'invalid media source';
  END IF;

  IF p_media_type NOT IN ('anime', 'movie', 'series') THEN
    RAISE EXCEPTION 'invalid media type';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 OR length(p_title) > 300 THEN
    RAISE EXCEPTION 'invalid title';
  END IF;

  IF p_score IS NOT NULL AND (p_score < 0 OR p_score > 100) THEN
    RAISE EXCEPTION 'invalid score';
  END IF;

  INSERT INTO public.media_records (
    media_key,
    source,
    external_id,
    media_type,
    title,
    title_original,
    poster_url,
    backdrop_url,
    release_date,
    genres,
    platforms,
    score,
    updated_at
  )
  VALUES (
    p_media_key,
    p_source,
    p_external_id,
    p_media_type,
    p_title,
    p_title_original,
    p_poster_url,
    p_backdrop_url,
    p_release_date,
    COALESCE(p_genres, '{}'::text[]),
    COALESCE(p_platforms, '[]'::jsonb),
    p_score,
    now()
  )
  ON CONFLICT (media_key)
  DO UPDATE SET
    source = EXCLUDED.source,
    external_id = EXCLUDED.external_id,
    media_type = EXCLUDED.media_type,
    title = EXCLUDED.title,
    title_original = EXCLUDED.title_original,
    poster_url = EXCLUDED.poster_url,
    backdrop_url = EXCLUDED.backdrop_url,
    release_date = EXCLUDED.release_date,
    genres = EXCLUDED.genres,
    platforms = EXCLUDED.platforms,
    score = EXCLUDED.score,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_media_record_snapshot(text, text, text, text, text, text, text, text, text, text[], jsonb, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_media_record_snapshot(text, text, text, text, text, text, text, text, text, text[], jsonb, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_media_record_snapshot(text, text, text, text, text, text, text, text, text, text[], jsonb, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_media_record_snapshot(text, text, text, text, text, text, text, text, text, text[], jsonb, numeric) TO service_role;