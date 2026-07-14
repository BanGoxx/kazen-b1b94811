-- Remove open write access to the shared catalog
DROP POLICY IF EXISTS "Signed-in users can add media snapshots" ON public.media_records;
DROP POLICY IF EXISTS "Signed-in users can update media snapshots" ON public.media_records;

-- Revoke direct table write privileges from authenticated users.
-- Reads stay open; service_role (trusted server paths) keeps full access.
REVOKE INSERT, UPDATE, DELETE ON public.media_records FROM authenticated;

-- Security-definer seeder: signed-in members may only CREATE a missing catalog
-- row. Existing rows are never overwritten (ON CONFLICT DO NOTHING), so no member
-- can tamper with another user's / the system's catalog data. The trusted
-- episodes_count column is intentionally not writable here.
CREATE OR REPLACE FUNCTION public.seed_media_snapshot(
  _media_key text,
  _source text,
  _external_id text,
  _media_type text,
  _title text,
  _title_original text DEFAULT NULL,
  _poster_url text DEFAULT NULL,
  _backdrop_url text DEFAULT NULL,
  _release_date text DEFAULT NULL,
  _genres text[] DEFAULT '{}',
  _platforms jsonb DEFAULT '[]'::jsonb,
  _score numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Same validation the old RLS check enforced.
  IF _media_key IS NULL OR length(_media_key) < 3 OR length(_media_key) > 128 THEN
    RAISE EXCEPTION 'Invalid media_key.';
  END IF;
  IF _source NOT IN ('anilist','tmdb_movie','tmdb_tv') THEN
    RAISE EXCEPTION 'Invalid source.';
  END IF;
  IF _media_type NOT IN ('anime','movie','series') THEN
    RAISE EXCEPTION 'Invalid media_type.';
  END IF;
  IF _title IS NULL OR length(trim(_title)) = 0 OR length(_title) > 300 THEN
    RAISE EXCEPTION 'Invalid title.';
  END IF;
  IF _score IS NOT NULL AND (_score < 0 OR _score > 100) THEN
    RAISE EXCEPTION 'Invalid score.';
  END IF;

  INSERT INTO public.media_records (
    media_key, source, external_id, media_type, title, title_original,
    poster_url, backdrop_url, release_date, genres, platforms, score
  ) VALUES (
    _media_key, _source, _external_id, _media_type, _title, _title_original,
    _poster_url, _backdrop_url, _release_date, coalesce(_genres,'{}'), coalesce(_platforms,'[]'::jsonb), _score
  )
  ON CONFLICT (media_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_media_snapshot(text,text,text,text,text,text,text,text,text,text[],jsonb,numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.seed_media_snapshot(text,text,text,text,text,text,text,text,text,text[],jsonb,numeric) TO authenticated;