-- KAZEN STAGING — ROLLBACK Option 1 bis (worker_no_authuid)
BEGIN;

CREATE OR REPLACE FUNCTION public.import_canonical_v2_claim_chunk(_batch_id uuid, _chunk_size integer DEFAULT 25)
 RETURNS TABLE(item_id uuid, provider_ref text, claim_token uuid, attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.import_canonical_v2_release_lock(_batch_id uuid, _claim_token uuid, _error_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.import_canonical_v2_store_chunk(_batch_id uuid, _claim_token uuid, _entries jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

COMMIT;