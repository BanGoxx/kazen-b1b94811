-- KAZEN STAGING — Import Canonicalization V2 (additive, isolated, staging-only)
-- =============================================================================
-- NOTE ON PATH: the Lovable Cloud tooling blocks direct writes to
-- supabase/migrations/. The final file will be materialised at
--   supabase/migrations/20260720010713_import_canonicalization_v2_staging.sql
-- by the supabase--migration tool, using the SQL body below VERBATIM, only
-- after your explicit authorisation. This draft is byte-identical to what
-- will be submitted; the SHA-256 in the report is computed on this file.
--
-- This migration ADDS parallel V2 objects. It NEVER alters V1 tables, policies,
-- indexes, RLS or grants. The only V1-touching statements are the two REVOKE
-- lines at the very end that remove PUBLIC/anon EXECUTE from the pre-existing
-- seed_media_snapshot* helpers. `authenticated` remains granted so V1
-- tracking, playlist and import paths keep working (contract section C).
--
-- Trust model: only the AniList payload fetched server-side is canonical.
-- Client-provided snapshots are ONLY tolerated as a preview hint and are
-- rebuilt+validated inside a SECURITY DEFINER helper before being written.
--
-- All V2 mutations happen exclusively through SECURITY DEFINER RPCs. Direct
-- writes to V2 tables are impossible for `authenticated` (no INSERT/UPDATE/
-- DELETE grant), and RLS additionally restricts SELECT to the batch owner.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Feature flag table (no IF NOT EXISTS — must fail if collision appears).
-- -----------------------------------------------------------------------------
CREATE TABLE public.app_feature_flags (
  flag_key    text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_feature_flags ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_feature_flags FROM PUBLIC;
REVOKE ALL ON public.app_feature_flags FROM anon;
REVOKE ALL ON public.app_feature_flags FROM authenticated;
GRANT  ALL ON public.app_feature_flags TO service_role;

-- No policies for anon/authenticated => table is invisible to clients.
-- Reads happen exclusively through the SECURITY DEFINER is_enabled RPC.

INSERT INTO public.app_feature_flags(flag_key, enabled, description)
VALUES ('IMPORT_CANONICALIZATION_V2', false,
        'Enables the V2 canonicalization import pipeline. Off by default.');

-- -----------------------------------------------------------------------------
-- 1. V2 batches table.
-- -----------------------------------------------------------------------------
CREATE TABLE public.import_canonical_v2_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  status          text NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created','processing','ready','completed','rolled_back','failed')),
  total_count     integer NOT NULL DEFAULT 0 CHECK (total_count BETWEEN 0 AND 5000),
  canonical_count integer NOT NULL DEFAULT 0,
  failed_count    integer NOT NULL DEFAULT 0,
  skipped_count   integer NOT NULL DEFAULT 0,
  applied_count   integer NOT NULL DEFAULT 0,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed_at    timestamptz,
  rolled_back_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_canonical_v2_batches_id_user_uk UNIQUE (id, user_id)
);

CREATE INDEX import_canonical_v2_batches_user_idx
  ON public.import_canonical_v2_batches(user_id, created_at DESC);

ALTER TABLE public.import_canonical_v2_batches ENABLE ROW LEVEL SECURITY;

REVOKE ALL     ON public.import_canonical_v2_batches FROM PUBLIC;
REVOKE ALL     ON public.import_canonical_v2_batches FROM anon;
REVOKE ALL     ON public.import_canonical_v2_batches FROM authenticated;
GRANT  SELECT  ON public.import_canonical_v2_batches TO authenticated;
GRANT  ALL     ON public.import_canonical_v2_batches TO service_role;

CREATE POLICY "v2_batches_owner_select"
  ON public.import_canonical_v2_batches
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. V2 items table. Composite FK guarantees ownership at DB level.
-- -----------------------------------------------------------------------------
CREATE TABLE public.import_canonical_v2_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id           uuid NOT NULL,
  user_id            uuid NOT NULL,
  ordinal            integer NOT NULL,
  provider_ref       text NOT NULL,
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','claimed','canonical','failed','skipped','applied')),
  attempts           integer NOT NULL DEFAULT 0,
  claim_token        uuid,
  claimed_at         timestamptz,
  raw_hint           jsonb,
  canonical_snapshot jsonb,
  applied_item       jsonb,
  error_code         text,
  error_message      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_canonical_v2_items_batch_owner_fk
    FOREIGN KEY (batch_id, user_id)
    REFERENCES public.import_canonical_v2_batches(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT import_canonical_v2_items_batch_ordinal_uk
    UNIQUE (batch_id, ordinal)
);

CREATE INDEX import_canonical_v2_items_batch_status_idx
  ON public.import_canonical_v2_items(batch_id, status);
CREATE INDEX import_canonical_v2_items_claim_idx
  ON public.import_canonical_v2_items(batch_id) WHERE status = 'pending';

ALTER TABLE public.import_canonical_v2_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL    ON public.import_canonical_v2_items FROM PUBLIC;
REVOKE ALL    ON public.import_canonical_v2_items FROM anon;
REVOKE ALL    ON public.import_canonical_v2_items FROM authenticated;
GRANT  SELECT ON public.import_canonical_v2_items TO authenticated;
GRANT  ALL    ON public.import_canonical_v2_items TO service_role;

CREATE POLICY "v2_items_owner_select"
  ON public.import_canonical_v2_items
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- =============================================================================
-- 3. Helpers (defined BEFORE any RPC that uses them; recompute BEFORE callers).
-- =============================================================================

-- 3.1 Strict JSON string-array validator: refuses casts, refuses non-strings.
CREATE OR REPLACE FUNCTION public.import_canonical_v2__require_string_array(
  _label text,
  _value jsonb
) RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_elem jsonb;
  v_out  text[] := ARRAY[]::text[];
BEGIN
  IF _value IS NULL OR jsonb_typeof(_value) = 'null' THEN
    RETURN v_out;
  END IF;
  IF jsonb_typeof(_value) <> 'array' THEN
    RAISE EXCEPTION 'invalid_canonical_payload: % must be a JSON array', _label
      USING ERRCODE = '22023';
  END IF;
  FOR v_elem IN SELECT * FROM jsonb_array_elements(_value)
  LOOP
    IF jsonb_typeof(v_elem) <> 'string' THEN
      RAISE EXCEPTION 'invalid_canonical_payload: % must contain only strings', _label
        USING ERRCODE = '22023';
    END IF;
    v_out := array_append(v_out, v_elem #>> '{}');
  END LOOP;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.import_canonical_v2__require_string_array(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_canonical_v2__require_string_array(text, jsonb) FROM anon, authenticated;

-- 3.2 Canonical snapshot builder — reconstructs a clean object from an
--     untrusted input, dropping unknown keys and validating every field.
--     Payload size hard-capped at 20KB.
CREATE OR REPLACE FUNCTION public.import_canonical_v2_build_canonical(
  _payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_media_key      text;
  v_source         text;
  v_external_id    text;
  v_media_type     text;
  v_title          text;
  v_title_original text;
  v_poster_url     text;
  v_backdrop_url   text;
  v_release_date   text;
  v_genres         text[];
  v_platforms      jsonb;
  v_score          numeric;
BEGIN
  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_canonical_payload: payload must be a JSON object'
      USING ERRCODE = '22023';
  END IF;
  IF octet_length(_payload::text) > 20480 THEN
    RAISE EXCEPTION 'invalid_canonical_payload: snapshot exceeds 20KB'
      USING ERRCODE = '22023';
  END IF;

  v_source      := NULLIF(_payload->>'source', '');
  v_external_id := NULLIF(_payload->>'external_id', '');
  v_media_type  := NULLIF(_payload->>'media_type', '');
  v_title       := NULLIF(_payload->>'title', '');
  IF v_source IS NULL OR v_external_id IS NULL OR v_media_type IS NULL OR v_title IS NULL THEN
    RAISE EXCEPTION 'invalid_canonical_payload: missing required field'
      USING ERRCODE = '22023';
  END IF;
  IF v_source NOT IN ('anilist','tmdb_movie','tmdb_tv') THEN
    RAISE EXCEPTION 'invalid_canonical_payload: unsupported source %', v_source
      USING ERRCODE = '22023';
  END IF;
  IF v_media_type NOT IN ('anime','movie','series') THEN
    RAISE EXCEPTION 'invalid_canonical_payload: unsupported media_type %', v_media_type
      USING ERRCODE = '22023';
  END IF;
  IF char_length(v_external_id) > 64 OR v_external_id !~ '^[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'invalid_canonical_payload: external_id malformed'
      USING ERRCODE = '22023';
  END IF;
  IF char_length(v_title) > 512 THEN
    RAISE EXCEPTION 'invalid_canonical_payload: title too long'
      USING ERRCODE = '22023';
  END IF;

  v_media_key := v_source || ':' || v_external_id;
  IF (_payload ? 'media_key') AND NULLIF(_payload->>'media_key','') IS DISTINCT FROM v_media_key THEN
    RAISE EXCEPTION 'invalid_canonical_payload: media_key does not match source:external_id'
      USING ERRCODE = '22023';
  END IF;

  v_title_original := NULLIF(_payload->>'title_original', '');
  v_poster_url     := NULLIF(_payload->>'poster_url', '');
  v_backdrop_url   := NULLIF(_payload->>'backdrop_url', '');
  v_release_date   := NULLIF(_payload->>'release_date', '');

  IF v_title_original IS NOT NULL AND char_length(v_title_original) > 512 THEN
    RAISE EXCEPTION 'invalid_canonical_payload: title_original too long' USING ERRCODE = '22023';
  END IF;
  IF v_poster_url IS NOT NULL AND (char_length(v_poster_url) > 2048 OR v_poster_url !~* '^https?://') THEN
    RAISE EXCEPTION 'invalid_canonical_payload: poster_url invalid' USING ERRCODE = '22023';
  END IF;
  IF v_backdrop_url IS NOT NULL AND (char_length(v_backdrop_url) > 2048 OR v_backdrop_url !~* '^https?://') THEN
    RAISE EXCEPTION 'invalid_canonical_payload: backdrop_url invalid' USING ERRCODE = '22023';
  END IF;
  IF v_release_date IS NOT NULL AND v_release_date !~ '^\d{4}(-\d{2}(-\d{2})?)?$' THEN
    RAISE EXCEPTION 'invalid_canonical_payload: release_date must be YYYY[-MM[-DD]]' USING ERRCODE = '22023';
  END IF;

  v_genres := public.import_canonical_v2__require_string_array('genres', _payload->'genres');
  IF array_length(v_genres, 1) > 32 THEN
    RAISE EXCEPTION 'invalid_canonical_payload: too many genres' USING ERRCODE = '22023';
  END IF;

  IF _payload ? 'platforms' THEN
    IF jsonb_typeof(_payload->'platforms') NOT IN ('array','object','null') THEN
      RAISE EXCEPTION 'invalid_canonical_payload: platforms must be array or object' USING ERRCODE = '22023';
    END IF;
    v_platforms := COALESCE(_payload->'platforms', '[]'::jsonb);
  ELSE
    v_platforms := '[]'::jsonb;
  END IF;

  IF _payload ? 'score' AND jsonb_typeof(_payload->'score') <> 'null' THEN
    IF jsonb_typeof(_payload->'score') <> 'number' THEN
      RAISE EXCEPTION 'invalid_canonical_payload: score must be a number' USING ERRCODE = '22023';
    END IF;
    v_score := (_payload->>'score')::numeric;
    IF v_score < 0 OR v_score > 100 THEN
      RAISE EXCEPTION 'invalid_canonical_payload: score out of range' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_score := NULL;
  END IF;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'media_key',      v_media_key,
    'source',         v_source,
    'external_id',    v_external_id,
    'media_type',     v_media_type,
    'title',          v_title,
    'title_original', v_title_original,
    'poster_url',     v_poster_url,
    'backdrop_url',   v_backdrop_url,
    'release_date',   v_release_date,
    'genres',         to_jsonb(v_genres),
    'platforms',      v_platforms,
    'score',          v_score
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.import_canonical_v2_build_canonical(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_canonical_v2_build_canonical(jsonb) FROM anon, authenticated;

-- 3.3 User-action validator — strict whitelist for list_items fields.
CREATE OR REPLACE FUNCTION public.import_canonical_v2_validate_user_action(
  _action jsonb
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_key    text;
  v_out    jsonb := '{}'::jsonb;
  v_status text;
  v_prio   text;
  v_rating int;
  v_prog   int;
  v_notes  text;
  v_tags   text[];
BEGIN
  IF _action IS NULL OR jsonb_typeof(_action) = 'null' THEN
    RETURN '{}'::jsonb;
  END IF;
  IF jsonb_typeof(_action) <> 'object' THEN
    RAISE EXCEPTION 'invalid_canonical_payload: user_action must be an object' USING ERRCODE = '22023';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(_action) LOOP
    IF v_key NOT IN ('status','rating','priority','notes','tags','favorite',
                     'progress','started_at','completed_at','is_rewatching','rewatch_count') THEN
      RAISE EXCEPTION 'invalid_canonical_payload: unknown user_action key %', v_key USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF _action ? 'status' THEN
    v_status := _action->>'status';
    IF v_status NOT IN ('a_voir','en_cours','termine','en_pause','abandonne') THEN
      RAISE EXCEPTION 'invalid_canonical_payload: bad status' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_object('status', v_status);
  END IF;

  IF _action ? 'priority' THEN
    v_prio := _action->>'priority';
    IF v_prio NOT IN ('basse','normale','haute') THEN
      RAISE EXCEPTION 'invalid_canonical_payload: bad priority' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_object('priority', v_prio);
  END IF;

  IF _action ? 'rating' AND jsonb_typeof(_action->'rating') <> 'null' THEN
    IF jsonb_typeof(_action->'rating') <> 'number' THEN
      RAISE EXCEPTION 'invalid_canonical_payload: rating must be integer' USING ERRCODE = '22023';
    END IF;
    v_rating := (_action->>'rating')::int;
    IF v_rating < 1 OR v_rating > 10 THEN
      RAISE EXCEPTION 'invalid_canonical_payload: rating out of range' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_object('rating', v_rating);
  END IF;

  IF _action ? 'progress' AND jsonb_typeof(_action->'progress') <> 'null' THEN
    IF jsonb_typeof(_action->'progress') <> 'number' THEN
      RAISE EXCEPTION 'invalid_canonical_payload: progress must be integer' USING ERRCODE = '22023';
    END IF;
    v_prog := (_action->>'progress')::int;
    IF v_prog < 0 OR v_prog > 100000 THEN
      RAISE EXCEPTION 'invalid_canonical_payload: progress out of range' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_object('progress', v_prog);
  END IF;

  IF _action ? 'notes' AND jsonb_typeof(_action->'notes') <> 'null' THEN
    IF jsonb_typeof(_action->'notes') <> 'string' THEN
      RAISE EXCEPTION 'invalid_canonical_payload: notes must be string' USING ERRCODE = '22023';
    END IF;
    v_notes := _action->>'notes';
    IF char_length(v_notes) > 4000 THEN
      RAISE EXCEPTION 'invalid_canonical_payload: notes too long' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_object('notes', v_notes);
  END IF;

  IF _action ? 'tags' THEN
    v_tags := public.import_canonical_v2__require_string_array('tags', _action->'tags');
    IF array_length(v_tags, 1) > 64 THEN
      RAISE EXCEPTION 'invalid_canonical_payload: too many tags' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_object('tags', to_jsonb(v_tags));
  END IF;

  IF _action ? 'favorite' THEN
    IF jsonb_typeof(_action->'favorite') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_canonical_payload: favorite must be boolean' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_object('favorite', (_action->>'favorite')::boolean);
  END IF;

  IF _action ? 'is_rewatching' THEN
    IF jsonb_typeof(_action->'is_rewatching') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_canonical_payload: is_rewatching must be boolean' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_object('is_rewatching', (_action->>'is_rewatching')::boolean);
  END IF;

  IF _action ? 'rewatch_count' AND jsonb_typeof(_action->'rewatch_count') <> 'null' THEN
    IF jsonb_typeof(_action->'rewatch_count') <> 'number' THEN
      RAISE EXCEPTION 'invalid_canonical_payload: rewatch_count must be integer' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_object('rewatch_count', (_action->>'rewatch_count')::int);
  END IF;

  IF _action ? 'started_at' AND jsonb_typeof(_action->'started_at') <> 'null' THEN
    IF (_action->>'started_at') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'invalid_canonical_payload: started_at must be YYYY-MM-DD' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_object('started_at', _action->>'started_at');
  END IF;

  IF _action ? 'completed_at' AND jsonb_typeof(_action->'completed_at') <> 'null' THEN
    IF (_action->>'completed_at') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'invalid_canonical_payload: completed_at must be YYYY-MM-DD' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_object('completed_at', _action->>'completed_at');
  END IF;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.import_canonical_v2_validate_user_action(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_canonical_v2_validate_user_action(jsonb) FROM anon, authenticated;

-- 3.4 Snapshot validator used by preview / create_batch client hint.
CREATE OR REPLACE FUNCTION public.import_canonical_v2_validate_snapshot(
  _snapshot jsonb
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT public.import_canonical_v2_build_canonical(_snapshot);
$$;

REVOKE ALL ON FUNCTION public.import_canonical_v2_validate_snapshot(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_canonical_v2_validate_snapshot(jsonb) FROM anon, authenticated;

-- 3.5 Recompute counters on the batch. Defined BEFORE any RPC that uses it.
CREATE OR REPLACE FUNCTION public.import_canonical_v2__recompute(
  _batch_id uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total     integer;
  v_canonical integer;
  v_failed    integer;
  v_skipped   integer;
  v_applied   integer;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status IN ('canonical','applied')),
    count(*) FILTER (WHERE status = 'failed'),
    count(*) FILTER (WHERE status = 'skipped'),
    count(*) FILTER (WHERE status = 'applied')
  INTO v_total, v_canonical, v_failed, v_skipped, v_applied
  FROM public.import_canonical_v2_items
  WHERE batch_id = _batch_id;

  UPDATE public.import_canonical_v2_batches
     SET canonical_count = v_canonical,
         failed_count    = v_failed,
         skipped_count   = v_skipped,
         applied_count   = v_applied,
         updated_at      = now()
   WHERE id = _batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.import_canonical_v2__recompute(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_canonical_v2__recompute(uuid) FROM anon, authenticated;

-- =============================================================================
-- 4. RPCs (9 required + skip_failed). All SECURITY DEFINER. All feature-gated
--    (except is_enabled itself, which BEARS the gate).
-- =============================================================================

-- 4.1 is_enabled
CREATE OR REPLACE FUNCTION public.import_canonical_v2_is_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.app_feature_flags
      WHERE flag_key = 'IMPORT_CANONICALIZATION_V2'),
    false);
$$;

REVOKE ALL     ON FUNCTION public.import_canonical_v2_is_enabled() FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.import_canonical_v2_is_enabled() FROM anon;
GRANT  EXECUTE ON FUNCTION public.import_canonical_v2_is_enabled() TO authenticated, service_role;

-- 4.2 create_batch — atomic validation of the raw payload (1..5000 items).
-- Contract-imposed signature: a single JSONB payload of the shape
--   { "provider": text, "items": jsonb[], "meta"?: jsonb }.
-- Provider/items/meta are extracted and validated atomically before any insert.
CREATE OR REPLACE FUNCTION public.import_canonical_v2_create_batch(
  _payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_batch_id uuid;
  v_count    integer;
  v_idx      integer := 0;
  v_item     jsonb;
  v_ref      text;
  v_provider text;
  v_items    jsonb;
  v_meta     jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.import_canonical_v2_is_enabled() THEN
    RAISE EXCEPTION 'feature_disabled' USING ERRCODE = '0A000';
  END IF;
  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_canonical_payload: payload must be an object' USING ERRCODE = '22023';
  END IF;

  v_provider := NULLIF(_payload->>'provider', '');
  IF v_provider IS NULL OR v_provider NOT IN ('anilist','myanimelist','nautiljon','anime-planet','simkl') THEN
    RAISE EXCEPTION 'invalid_canonical_payload: unsupported provider' USING ERRCODE = '22023';
  END IF;

  v_items := _payload->'items';
  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_canonical_payload: items must be an array' USING ERRCODE = '22023';
  END IF;
  v_count := jsonb_array_length(v_items);
  IF v_count < 1 OR v_count > 5000 THEN
    RAISE EXCEPTION 'invalid_canonical_payload: item count % out of range [1..5000]', v_count USING ERRCODE = '22023';
  END IF;

  IF _payload ? 'meta' THEN
    IF jsonb_typeof(_payload->'meta') <> 'object' THEN
      RAISE EXCEPTION 'invalid_canonical_payload: meta must be an object' USING ERRCODE = '22023';
    END IF;
    v_meta := _payload->'meta';
  ELSE
    v_meta := '{}'::jsonb;
  END IF;

  -- Full atomic validation pass BEFORE any insert. RAISE on the first bad item.
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'invalid_canonical_payload: item #% not an object', v_idx USING ERRCODE = '22023';
    END IF;
    v_ref := NULLIF(v_item->>'provider_ref', '');
    IF v_ref IS NULL OR char_length(v_ref) > 512 THEN
      RAISE EXCEPTION 'invalid_canonical_payload: item #% missing provider_ref', v_idx USING ERRCODE = '22023';
    END IF;
    IF v_item ? 'user_action' THEN
      PERFORM public.import_canonical_v2_validate_user_action(v_item->'user_action');
    END IF;
    IF v_item ? 'hint' AND jsonb_typeof(v_item->'hint') NOT IN ('object','null') THEN
      RAISE EXCEPTION 'invalid_canonical_payload: item #% hint must be object', v_idx USING ERRCODE = '22023';
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  INSERT INTO public.import_canonical_v2_batches(user_id, provider, total_count, meta)
  VALUES (v_user, v_provider, v_count, v_meta)
  RETURNING id INTO v_batch_id;

  v_idx := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    INSERT INTO public.import_canonical_v2_items(
      batch_id, user_id, ordinal, provider_ref, raw_hint
    ) VALUES (
      v_batch_id, v_user, v_idx, v_item->>'provider_ref',
      CASE WHEN v_item ? 'hint' THEN v_item->'hint' ELSE NULL END
    );
    v_idx := v_idx + 1;
  END LOOP;

  PERFORM public.import_canonical_v2__recompute(v_batch_id);
  RETURN v_batch_id;
END;
$$;

REVOKE ALL     ON FUNCTION public.import_canonical_v2_create_batch(jsonb) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.import_canonical_v2_create_batch(jsonb) FROM anon;
GRANT  EXECUTE ON FUNCTION public.import_canonical_v2_create_batch(jsonb) TO authenticated, service_role;

-- 4.3 preview — read-only summary; owner-scoped.
CREATE OR REPLACE FUNCTION public.import_canonical_v2_preview(
  _batch_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row  public.import_canonical_v2_batches%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.import_canonical_v2_is_enabled() THEN
    RAISE EXCEPTION 'feature_disabled' USING ERRCODE = '0A000';
  END IF;
  SELECT * INTO v_row FROM public.import_canonical_v2_batches
   WHERE id = _batch_id AND user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'batch_not_found' USING ERRCODE = '02000';
  END IF;
  RETURN jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'provider', v_row.provider,
    'total_count', v_row.total_count,
    'canonical_count', v_row.canonical_count,
    'failed_count', v_row.failed_count,
    'skipped_count', v_row.skipped_count,
    'applied_count', v_row.applied_count,
    'can_confirm', v_row.status IN ('created','processing','ready')
                   AND v_row.failed_count = 0
                   AND v_row.canonical_count + v_row.skipped_count = v_row.total_count
  );
END;
$$;

REVOKE ALL     ON FUNCTION public.import_canonical_v2_preview(uuid) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.import_canonical_v2_preview(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.import_canonical_v2_preview(uuid) TO authenticated, service_role;

-- 4.4 claim_chunk — CTE-based multi-row claim.
CREATE OR REPLACE FUNCTION public.import_canonical_v2_claim_chunk(
  _batch_id  uuid,
  _chunk_size int DEFAULT 25
) RETURNS TABLE(item_id uuid, provider_ref text, claim_token uuid, attempts int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_token uuid := gen_random_uuid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.import_canonical_v2_is_enabled() THEN
    RAISE EXCEPTION 'feature_disabled' USING ERRCODE = '0A000';
  END IF;
  IF _chunk_size IS NULL OR _chunk_size < 1 OR _chunk_size > 100 THEN
    RAISE EXCEPTION 'invalid_canonical_payload: chunk_size out of range' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.import_canonical_v2_batches
   WHERE id = _batch_id AND user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'batch_not_found' USING ERRCODE = '02000';
  END IF;

  UPDATE public.import_canonical_v2_batches
     SET status = CASE WHEN status = 'created' THEN 'processing' ELSE status END,
         updated_at = now()
   WHERE id = _batch_id;

  RETURN QUERY
  WITH picked AS (
    SELECT id
      FROM public.import_canonical_v2_items
     WHERE batch_id = _batch_id
       AND user_id  = v_user
       AND status   = 'pending'
     ORDER BY ordinal
     LIMIT _chunk_size
     FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.import_canonical_v2_items i
       SET status      = 'claimed',
           claim_token = v_token,
           claimed_at  = now(),
           attempts    = i.attempts + 1,
           updated_at  = now()
      FROM picked
     WHERE i.id = picked.id
     RETURNING i.id, i.provider_ref, i.claim_token, i.attempts
  )
  SELECT updated.id, updated.provider_ref, updated.claim_token, updated.attempts FROM updated;
END;
$$;

REVOKE ALL     ON FUNCTION public.import_canonical_v2_claim_chunk(uuid, int) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.import_canonical_v2_claim_chunk(uuid, int) FROM anon;
REVOKE ALL     ON FUNCTION public.import_canonical_v2_claim_chunk(uuid, int) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.import_canonical_v2_claim_chunk(uuid, int) TO service_role;

-- 4.5 store_chunk — atomic full-chunk write, no partial application.
--
-- Contract-imposed signature: (uuid _batch_id, uuid _claim_token, jsonb _entries).
-- The claim_token is passed OUT of the JSON payload and is the single source of
-- lock authority for the whole chunk. All entries in _entries MUST refer to
-- items currently 'claimed' with _claim_token; per-entry claim tokens are not
-- accepted. Retryable error classes (provider_rate_limited, provider_timeout,
-- provider_unavailable) MUST NOT be sent to store_chunk before the fifth
-- attempt; they belong on release_lock. Terminal errors (provider_not_found,
-- provider_id_mismatch, invalid_canonical_payload) go straight to failed.
CREATE OR REPLACE FUNCTION public.import_canonical_v2_store_chunk(
  _batch_id    uuid,
  _claim_token uuid,
  _entries     jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_expected integer;
  v_got      integer;
  v_entry    jsonb;
  v_item_id  uuid;
  v_kind     text;
  v_error    text;
  v_msg      text;
  v_snap     jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.import_canonical_v2_is_enabled() THEN
    RAISE EXCEPTION 'feature_disabled' USING ERRCODE = '0A000';
  END IF;
  IF _claim_token IS NULL THEN
    RAISE EXCEPTION 'invalid_canonical_payload: claim_token is required' USING ERRCODE = '22023';
  END IF;
  IF _entries IS NULL OR jsonb_typeof(_entries) <> 'array' THEN
    RAISE EXCEPTION 'invalid_canonical_payload: entries must be an array' USING ERRCODE = '22023';
  END IF;
  v_expected := jsonb_array_length(_entries);
  IF v_expected < 1 OR v_expected > 100 THEN
    RAISE EXCEPTION 'invalid_canonical_payload: chunk size out of range' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.import_canonical_v2_batches
   WHERE id = _batch_id AND user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'batch_not_found' USING ERRCODE = '02000';
  END IF;

  v_got := 0;
  FOR v_entry IN SELECT * FROM jsonb_array_elements(_entries) LOOP
    IF v_entry ? 'claim_token' THEN
      RAISE EXCEPTION 'invalid_canonical_payload: entries must not carry claim_token'
        USING ERRCODE = '22023';
    END IF;
    v_item_id := (v_entry->>'item_id')::uuid;
    v_kind    := v_entry->>'kind';
    IF v_item_id IS NULL OR v_kind NOT IN ('canonical','failed') THEN
      RAISE EXCEPTION 'invalid_canonical_payload: bad entry' USING ERRCODE = '22023';
    END IF;

    IF v_kind = 'canonical' THEN
      v_snap := public.import_canonical_v2_build_canonical(v_entry->'snapshot');

      UPDATE public.import_canonical_v2_items
         SET status = 'canonical',
             canonical_snapshot = v_snap,
             error_code = NULL,
             error_message = NULL,
             claim_token = NULL,
             updated_at = now()
       WHERE id = v_item_id
         AND batch_id = _batch_id
         AND user_id  = v_user
         AND status   = 'claimed'
         AND claim_token = _claim_token;
    ELSE
      v_error := NULLIF(v_entry->>'error_code','');
      v_msg   := NULLIF(v_entry->>'error_message','');
      IF v_error IS NULL THEN
        RAISE EXCEPTION 'invalid_canonical_payload: failed entry needs error_code' USING ERRCODE = '22023';
      END IF;
      IF v_error IN ('provider_rate_limited','provider_timeout','provider_unavailable') THEN
        -- Retryable errors must reach store_chunk only on the 5th attempt.
        UPDATE public.import_canonical_v2_items
           SET status = 'failed',
               error_code = v_error,
               error_message = v_msg,
               claim_token = NULL,
               updated_at = now()
         WHERE id = v_item_id
           AND batch_id = _batch_id
           AND user_id  = v_user
           AND status   = 'claimed'
           AND claim_token = _claim_token
           AND attempts >= 5;
      ELSE
        UPDATE public.import_canonical_v2_items
           SET status = 'failed',
               error_code = v_error,
               error_message = v_msg,
               claim_token = NULL,
               updated_at = now()
         WHERE id = v_item_id
           AND batch_id = _batch_id
           AND user_id  = v_user
           AND status   = 'claimed'
           AND claim_token = _claim_token;
      END IF;
    END IF;

    IF FOUND THEN
      v_got := v_got + 1;
    END IF;
  END LOOP;

  IF v_got <> v_expected THEN
    RAISE EXCEPTION 'partial_chunk_rejected: expected % writes, applied %', v_expected, v_got
      USING ERRCODE = '40001';
  END IF;

  PERFORM public.import_canonical_v2__recompute(_batch_id);
  RETURN jsonb_build_object('stored', v_got);
END;
$$;

REVOKE ALL     ON FUNCTION public.import_canonical_v2_store_chunk(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.import_canonical_v2_store_chunk(uuid, uuid, jsonb) FROM anon;
REVOKE ALL     ON FUNCTION public.import_canonical_v2_store_chunk(uuid, uuid, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.import_canonical_v2_store_chunk(uuid, uuid, jsonb) TO service_role;

-- 4.6 progress
CREATE OR REPLACE FUNCTION public.import_canonical_v2_progress(
  _batch_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row  public.import_canonical_v2_batches%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE='28000'; END IF;
  IF NOT public.import_canonical_v2_is_enabled() THEN
    RAISE EXCEPTION 'feature_disabled' USING ERRCODE='0A000';
  END IF;
  SELECT * INTO v_row FROM public.import_canonical_v2_batches
   WHERE id=_batch_id AND user_id=v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch_not_found' USING ERRCODE='02000'; END IF;
  RETURN jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'total', v_row.total_count,
    'canonical', v_row.canonical_count,
    'failed', v_row.failed_count,
    'skipped', v_row.skipped_count,
    'applied', v_row.applied_count,
    'pending', v_row.total_count
             - v_row.canonical_count
             - v_row.failed_count
             - v_row.skipped_count
             - v_row.applied_count
  );
END;
$$;

REVOKE ALL     ON FUNCTION public.import_canonical_v2_progress(uuid) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.import_canonical_v2_progress(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.import_canonical_v2_progress(uuid) TO authenticated, service_role;

-- 4.7 confirm — idempotent. Refuses while failed_count>0.
CREATE OR REPLACE FUNCTION public.import_canonical_v2_confirm(
  _batch_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user      uuid := auth.uid();
  v_row       public.import_canonical_v2_batches%ROWTYPE;
  v_item      record;
  v_media_key text;
  v_action    jsonb;
  v_applied   jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE='28000'; END IF;
  IF NOT public.import_canonical_v2_is_enabled() THEN
    RAISE EXCEPTION 'feature_disabled' USING ERRCODE='0A000';
  END IF;

  SELECT * INTO v_row FROM public.import_canonical_v2_batches
   WHERE id=_batch_id AND user_id=v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch_not_found' USING ERRCODE='02000'; END IF;

  -- Idempotent short-circuit
  IF v_row.status = 'completed' THEN
    RETURN jsonb_build_object(
      'already', true,
      'id', v_row.id,
      'status', v_row.status,
      'applied', v_row.applied_count,
      'skipped', v_row.skipped_count,
      'failed',  v_row.failed_count,
      'canonical', v_row.canonical_count,
      'total', v_row.total_count
    );
  END IF;

  IF v_row.status NOT IN ('created','processing','ready') THEN
    RAISE EXCEPTION 'batch_not_confirmable' USING ERRCODE='0A000';
  END IF;
  IF v_row.failed_count > 0 THEN
    RAISE EXCEPTION 'confirm_refused_failed_items_present' USING ERRCODE='0A000';
  END IF;
  IF (v_row.canonical_count + v_row.skipped_count) <> v_row.total_count THEN
    RAISE EXCEPTION 'confirm_refused_batch_not_ready' USING ERRCODE='0A000';
  END IF;

  FOR v_item IN
    SELECT id, canonical_snapshot, raw_hint
      FROM public.import_canonical_v2_items
     WHERE batch_id = _batch_id
       AND user_id  = v_user
       AND status   = 'canonical'
     ORDER BY ordinal
  LOOP
    v_media_key := v_item.canonical_snapshot->>'media_key';

    -- Upsert media_records only if the row does not exist; never overwrite.
    INSERT INTO public.media_records(
      media_key, source, external_id, media_type, title, title_original,
      poster_url, backdrop_url, release_date, genres, platforms, score, created_by
    )
    VALUES (
      v_media_key,
      v_item.canonical_snapshot->>'source',
      v_item.canonical_snapshot->>'external_id',
      v_item.canonical_snapshot->>'media_type',
      v_item.canonical_snapshot->>'title',
      v_item.canonical_snapshot->>'title_original',
      v_item.canonical_snapshot->>'poster_url',
      v_item.canonical_snapshot->>'backdrop_url',
      v_item.canonical_snapshot->>'release_date',
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(v_item.canonical_snapshot->'genres')),
        ARRAY[]::text[]),
      COALESCE(v_item.canonical_snapshot->'platforms','[]'::jsonb),
      NULLIF(v_item.canonical_snapshot->>'score','')::numeric,
      v_user
    )
    ON CONFLICT (media_key) DO NOTHING;

    -- Whitelisted user_action for list_items.
    v_action := public.import_canonical_v2_validate_user_action(
      COALESCE(v_item.raw_hint->'user_action', '{}'::jsonb));

    INSERT INTO public.list_items(
      user_id, media_key,
      status, rating, priority, notes, tags, favorite,
      progress, started_at, completed_at, is_rewatching, rewatch_count,
      import_provider, import_ref
    )
    VALUES (
      v_user,
      v_media_key,
      COALESCE((v_action->>'status')::watch_status, NULL),
      NULLIF(v_action->>'rating','')::smallint,
      COALESCE((v_action->>'priority')::priority_level, 'normale'::priority_level),
      COALESCE(v_action->>'notes',''),
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(v_action->'tags')),
        ARRAY[]::text[]),
      COALESCE((v_action->>'favorite')::boolean, false),
      NULLIF(v_action->>'progress','')::int,
      NULLIF(v_action->>'started_at','')::date,
      NULLIF(v_action->>'completed_at','')::date,
      COALESCE((v_action->>'is_rewatching')::boolean, false),
      COALESCE((v_action->>'rewatch_count')::int, 0),
      v_row.provider,
      _batch_id::text
    )
    ON CONFLICT DO NOTHING;

    v_applied := jsonb_build_object('media_key', v_media_key, 'action', v_action);

    UPDATE public.import_canonical_v2_items
       SET status = 'applied',
           applied_item = v_applied,
           updated_at = now()
     WHERE id = v_item.id;
  END LOOP;

  UPDATE public.import_canonical_v2_batches
     SET status = 'completed',
         confirmed_at = now(),
         updated_at = now()
   WHERE id = _batch_id;

  PERFORM public.import_canonical_v2__recompute(_batch_id);

  SELECT * INTO v_row FROM public.import_canonical_v2_batches WHERE id = _batch_id;
  RETURN jsonb_build_object(
    'already', false,
    'id', v_row.id,
    'status', v_row.status,
    'applied', v_row.applied_count,
    'skipped', v_row.skipped_count,
    'failed',  v_row.failed_count,
    'canonical', v_row.canonical_count,
    'total', v_row.total_count
  );
END;
$$;

REVOKE ALL     ON FUNCTION public.import_canonical_v2_confirm(uuid) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.import_canonical_v2_confirm(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.import_canonical_v2_confirm(uuid) TO authenticated, service_role;

-- 4.8 rollback — idempotent; only from 'completed'; never DELETE media_records.
CREATE OR REPLACE FUNCTION public.import_canonical_v2_rollback(
  _batch_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_row      public.import_canonical_v2_batches%ROWTYPE;
  v_item     record;
  v_reverted int := 0;
  v_skipped  int := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE='28000'; END IF;
  IF NOT public.import_canonical_v2_is_enabled() THEN
    RAISE EXCEPTION 'feature_disabled' USING ERRCODE='0A000';
  END IF;

  SELECT * INTO v_row FROM public.import_canonical_v2_batches
   WHERE id=_batch_id AND user_id=v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch_not_found' USING ERRCODE='02000'; END IF;

  IF v_row.status = 'rolled_back' THEN
    RETURN jsonb_build_object(
      'already', true,
      'id', v_row.id,
      'status', v_row.status,
      'reverted', v_row.meta->>'rollback_reverted',
      'skipped',  v_row.meta->>'rollback_skipped'
    );
  END IF;

  IF v_row.status <> 'completed' THEN
    RAISE EXCEPTION 'rollback_only_from_completed' USING ERRCODE='0A000';
  END IF;

  FOR v_item IN
    SELECT id, applied_item
      FROM public.import_canonical_v2_items
     WHERE batch_id=_batch_id AND user_id=v_user AND status='applied'
  LOOP
    -- Conflict guard: only delete the list_item if it still matches what we
    -- applied. If the user has since edited it, we skip silently and record
    -- a conflict. We NEVER delete a media_records row in V2 initial.
    DELETE FROM public.list_items
     WHERE user_id  = v_user
       AND media_key = v_item.applied_item->>'media_key'
       AND import_ref = _batch_id::text;
    IF FOUND THEN
      v_reverted := v_reverted + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  UPDATE public.import_canonical_v2_batches
     SET status = 'rolled_back',
         rolled_back_at = now(),
         meta = meta
              || jsonb_build_object(
                   'rollback_reverted', v_reverted,
                   'rollback_skipped',  v_skipped),
         updated_at = now()
   WHERE id = _batch_id;

  RETURN jsonb_build_object(
    'already', false,
    'id', _batch_id,
    'status', 'rolled_back',
    'reverted', v_reverted,
    'skipped',  v_skipped
  );
END;
$$;

REVOKE ALL     ON FUNCTION public.import_canonical_v2_rollback(uuid) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.import_canonical_v2_rollback(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.import_canonical_v2_rollback(uuid) TO authenticated, service_role;

-- 4.9 release_lock — for retryable errors (rate_limited/timeout/unavailable).
--
-- Contract-imposed signature: (uuid _batch_id, uuid _claim_token, text _error_code).
-- Releases EVERY item still 'claimed' with the given claim_token back to
-- 'pending', recording the retryable error code on all of them. Item ids are
-- not required: the claim_token identifies the chunk atomically.
CREATE OR REPLACE FUNCTION public.import_canonical_v2_release_lock(
  _batch_id    uuid,
  _claim_token uuid,
  _error_code  text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_released integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE='28000'; END IF;
  IF NOT public.import_canonical_v2_is_enabled() THEN
    RAISE EXCEPTION 'feature_disabled' USING ERRCODE='0A000';
  END IF;
  IF _claim_token IS NULL THEN
    RAISE EXCEPTION 'invalid_canonical_payload: claim_token is required' USING ERRCODE='22023';
  END IF;
  IF _error_code IS NULL
     OR _error_code NOT IN ('provider_rate_limited','provider_timeout','provider_unavailable') THEN
    RAISE EXCEPTION 'invalid_canonical_payload: release_lock accepts only retryable error codes'
      USING ERRCODE='22023';
  END IF;

  PERFORM 1 FROM public.import_canonical_v2_batches
   WHERE id = _batch_id AND user_id = v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch_not_found' USING ERRCODE='02000'; END IF;

  UPDATE public.import_canonical_v2_items
     SET status      = 'pending',
         claim_token = NULL,
         error_code  = _error_code,
         updated_at  = now()
   WHERE batch_id    = _batch_id
     AND user_id     = v_user
     AND status      = 'claimed'
     AND claim_token = _claim_token;
  GET DIAGNOSTICS v_released = ROW_COUNT;

  RETURN jsonb_build_object('released', v_released);
END;
$$;

REVOKE ALL     ON FUNCTION public.import_canonical_v2_release_lock(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.import_canonical_v2_release_lock(uuid, uuid, text) FROM anon;
REVOKE ALL     ON FUNCTION public.import_canonical_v2_release_lock(uuid, uuid, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.import_canonical_v2_release_lock(uuid, uuid, text) TO service_role;

-- 4.10 skip_failed — strict, atomic, all-or-nothing.
CREATE OR REPLACE FUNCTION public.import_canonical_v2_skip_failed(
  _batch_id uuid,
  _item_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_distinct integer;
  v_updated  integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE='28000'; END IF;
  IF NOT public.import_canonical_v2_is_enabled() THEN
    RAISE EXCEPTION 'feature_disabled' USING ERRCODE='0A000';
  END IF;
  IF _item_ids IS NULL OR array_length(_item_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'invalid_canonical_payload: item_ids must be a non-empty array' USING ERRCODE='22023';
  END IF;
  SELECT count(DISTINCT x) INTO v_distinct FROM unnest(_item_ids) AS x;
  IF v_distinct <> array_length(_item_ids, 1) THEN
    RAISE EXCEPTION 'invalid_canonical_payload: item_ids contains duplicates' USING ERRCODE='22023';
  END IF;

  PERFORM 1 FROM public.import_canonical_v2_batches
   WHERE id = _batch_id AND user_id = v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch_not_found' USING ERRCODE='02000'; END IF;

  -- Pre-check: every ID must belong to this batch AND be currently 'failed'.
  IF EXISTS (
    SELECT 1
      FROM unnest(_item_ids) AS x(id)
      LEFT JOIN public.import_canonical_v2_items i
        ON i.id = x.id AND i.batch_id = _batch_id AND i.user_id = v_user
     WHERE i.id IS NULL OR i.status <> 'failed'
  ) THEN
    RAISE EXCEPTION 'skip_failed_rejected: one or more items are foreign or not failed'
      USING ERRCODE='0A000';
  END IF;

  UPDATE public.import_canonical_v2_items
     SET status = 'skipped',
         updated_at = now()
   WHERE batch_id = _batch_id
     AND user_id  = v_user
     AND status   = 'failed'
     AND id       = ANY(_item_ids);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> v_distinct THEN
    -- Impossible under normal locking but enforce atomicity explicitly.
    RAISE EXCEPTION 'skip_failed_rejected: race condition; no partial update applied'
      USING ERRCODE='40001';
  END IF;

  PERFORM public.import_canonical_v2__recompute(_batch_id);
  RETURN jsonb_build_object('skipped', v_updated);
END;
$$;

REVOKE ALL     ON FUNCTION public.import_canonical_v2_skip_failed(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.import_canonical_v2_skip_failed(uuid, uuid[]) FROM anon;
GRANT  EXECUTE ON FUNCTION public.import_canonical_v2_skip_failed(uuid, uuid[]) TO authenticated, service_role;

-- =============================================================================
-- 5. Staging ACL correction: seed helpers locked to postgres, service_role AND
--    authenticated. Only PUBLIC and anon are revoked. authenticated MUST stay
--    granted because V1 tracking, V1 playlist and V1 import all invoke these
--    helpers from user-authenticated code paths.
--    These REVOKEs are the ONLY V1-touching statements in this migration.
--    Signatures are exact (see preflight audit).
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.seed_media_snapshot(
  _media_key text, _source text, _external_id text, _media_type text, _title text,
  _title_original text, _poster_url text, _backdrop_url text, _release_date text,
  _genres text[], _platforms jsonb, _score numeric
) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.seed_media_snapshot_for_batch(
  _batch_id uuid, _media_key text, _source text, _external_id text, _media_type text,
  _title text, _title_original text, _poster_url text, _backdrop_url text,
  _release_date text, _genres text[], _platforms jsonb, _score numeric
) FROM PUBLIC, anon;

-- =============================================================================
-- END OF MIGRATION.
-- =============================================================================