
CREATE OR REPLACE FUNCTION public.seed_media_snapshot_for_batch(
  _batch_id uuid,
  _media_key text,
  _source text,
  _external_id text,
  _media_type text,
  _title text,
  _title_original text DEFAULT NULL,
  _poster_url text DEFAULT NULL,
  _backdrop_url text DEFAULT NULL,
  _release_date text DEFAULT NULL,
  _genres text[] DEFAULT '{}'::text[],
  _platforms jsonb DEFAULT '[]'::jsonb,
  _score numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  caller uuid := auth.uid();
  canonical_key text;
  clean_title text;
  clean_title_original text;
  clean_poster text;
  clean_backdrop text;
  clean_release text;
  parsed_date date;
  batch_owner uuid;
  batch_status text;
  seeded_by_batch integer;
  BATCH_HARD_CAP constant integer := 5000;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Ownership + statut du batch : chemin d'import légitime uniquement
  SELECT user_id, status INTO batch_owner, batch_status
  FROM public.import_batches
  WHERE id = _batch_id;
  IF batch_owner IS NULL THEN
    RAISE EXCEPTION 'Batch introuvable.';
  END IF;
  IF batch_owner <> caller THEN
    RAISE EXCEPTION 'Batch appartient à un autre membre.';
  END IF;
  IF batch_status NOT IN ('parsed', 'needs_review') THEN
    RAISE EXCEPTION 'Batch non prévisualisé ou déjà terminé.';
  END IF;

  -- Plafond produit : au maximum BATCH_HARD_CAP nouveaux médias par batch.
  -- On borne l'utilisation totale par batch (co-création via cette RPC).
  SELECT count(*) INTO seeded_by_batch
  FROM public.media_records mr
  JOIN public.import_items ii ON ii.matched_media_key = mr.media_key
  WHERE ii.batch_id = _batch_id
    AND mr.created_by = caller;
  IF seeded_by_batch >= BATCH_HARD_CAP THEN
    RAISE EXCEPTION 'Plafond produit atteint pour ce batch (%).', BATCH_HARD_CAP;
  END IF;

  -- Validations réutilisées (miroir strict de seed_media_snapshot) --
  IF _source NOT IN ('anilist','tmdb_movie','tmdb_tv') THEN
    RAISE EXCEPTION 'Invalid source.';
  END IF;
  IF _media_type NOT IN ('anime','movie','series') THEN
    RAISE EXCEPTION 'Invalid media_type.';
  END IF;
  IF _external_id IS NULL OR _external_id !~ '^[1-9][0-9]{0,9}$' THEN
    RAISE EXCEPTION 'Invalid external_id.';
  END IF;
  canonical_key := _source || ':' || _external_id;
  IF _media_key IS DISTINCT FROM canonical_key THEN
    RAISE EXCEPTION 'media_key must match source:external_id.';
  END IF;

  clean_title := regexp_replace(coalesce(_title, ''), '<[^>]*>', '', 'g');
  clean_title := regexp_replace(clean_title, '[\u0000-\u0008\u000B\u000C\u000E-\u001F]', '', 'g');
  clean_title := trim(clean_title);
  IF char_length(clean_title) = 0 OR char_length(clean_title) > 300 THEN
    RAISE EXCEPTION 'Invalid title.';
  END IF;

  IF _title_original IS NOT NULL THEN
    clean_title_original := regexp_replace(_title_original, '<[^>]*>', '', 'g');
    clean_title_original := regexp_replace(clean_title_original, '[\u0000-\u0008\u000B\u000C\u000E-\u001F]', '', 'g');
    clean_title_original := trim(clean_title_original);
    IF char_length(clean_title_original) = 0 THEN
      clean_title_original := NULL;
    ELSIF char_length(clean_title_original) > 300 THEN
      clean_title_original := left(clean_title_original, 300);
    END IF;
  END IF;

  IF _poster_url IS NOT NULL AND _poster_url ~* '^https://[^\s<>"]{5,}$' THEN
    clean_poster := left(_poster_url, 1024);
  END IF;
  IF _backdrop_url IS NOT NULL AND _backdrop_url ~* '^https://[^\s<>"]{5,}$' THEN
    clean_backdrop := left(_backdrop_url, 1024);
  END IF;

  IF _release_date IS NOT NULL AND _release_date <> '' THEN
    BEGIN
      parsed_date := _release_date::date;
      clean_release := _release_date;
    EXCEPTION WHEN OTHERS THEN
      clean_release := NULL;
    END;
  END IF;

  IF _score IS NOT NULL AND (_score < 0 OR _score > 100) THEN
    RAISE EXCEPTION 'Invalid score.';
  END IF;

  INSERT INTO public.media_records (
    media_key, source, external_id, media_type, title, title_original,
    poster_url, backdrop_url, release_date, genres, platforms, score, created_by
  ) VALUES (
    canonical_key, _source, _external_id, _media_type, clean_title, clean_title_original,
    clean_poster, clean_backdrop, clean_release,
    coalesce(_genres, '{}'::text[]), coalesce(_platforms, '[]'::jsonb), _score, caller
  )
  ON CONFLICT (media_key) DO NOTHING;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.seed_media_snapshot_for_batch(
  uuid, text, text, text, text, text, text, text, text, text, text[], jsonb, numeric
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.seed_media_snapshot_for_batch(
  uuid, text, text, text, text, text, text, text, text, text, text[], jsonb, numeric
) TO authenticated, service_role;
