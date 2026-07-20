BEGIN;

CREATE OR REPLACE FUNCTION public.import_canonical_v2_claim_chunk(
  _batch_id uuid,
  _chunk_size integer DEFAULT 25
)
RETURNS TABLE(item_id uuid, provider_ref text, claim_token uuid, attempts integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner  uuid;
  v_status text;
  v_token  uuid := gen_random_uuid();
  v_cutoff timestamptz := now() - interval '5 minutes';
  v_autofailed integer;
BEGIN
  IF _chunk_size IS NULL OR _chunk_size < 1 OR _chunk_size > 50 THEN
    RAISE EXCEPTION 'invalid_canonical_payload: chunk_size out of range [1..50]'
      USING ERRCODE = '22023';
  END IF;

  SELECT b.user_id, b.status
    INTO v_owner, v_status
    FROM public.import_canonical_v2_batches AS b
   WHERE b.id = _batch_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'batch_not_found' USING ERRCODE = '02000';
  END IF;

  IF v_status NOT IN ('created','processing') THEN
    RAISE EXCEPTION 'invalid_batch_state: %', v_status USING ERRCODE = '22023';
  END IF;

  IF NOT public.import_canonical_v2__is_enabled_for_user(v_owner) THEN
    RAISE EXCEPTION 'feature_disabled' USING ERRCODE = '0A000';
  END IF;

  UPDATE public.import_canonical_v2_batches AS b
     SET status     = CASE WHEN b.status = 'created' THEN 'processing' ELSE b.status END,
         updated_at = now()
   WHERE b.id = _batch_id;

  UPDATE public.import_canonical_v2_items AS i
     SET status        = 'failed',
         claim_token   = NULL,
         claimed_at    = NULL,
         error_code    = 'worker_claim_expired_max_attempts',
         error_message = 'auto-failed: claim expired after max attempts',
         updated_at    = now()
   WHERE i.batch_id  = _batch_id
     AND i.user_id   = v_owner
     AND i.status    = 'claimed'
     AND i.attempts  >= 5
     AND i.claimed_at IS NOT NULL
     AND i.claimed_at <= v_cutoff;
  GET DIAGNOSTICS v_autofailed = ROW_COUNT;
  IF v_autofailed > 0 THEN
    PERFORM public.import_canonical_v2__recompute(_batch_id);
  END IF;

  RETURN QUERY
  WITH picked AS (
    SELECT i.id AS picked_id
      FROM public.import_canonical_v2_items AS i
     WHERE i.batch_id  = _batch_id
       AND i.user_id   = v_owner
       AND i.attempts  < 5
       AND (
             i.status = 'pending'
         OR (i.status = 'claimed' AND (i.claimed_at IS NULL OR i.claimed_at <= v_cutoff))
       )
     ORDER BY i.ordinal
     LIMIT _chunk_size
     FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.import_canonical_v2_items AS i
       SET status      = 'claimed',
           claim_token = v_token,
           claimed_at  = now(),
           attempts    = i.attempts + 1,
           updated_at  = now()
      FROM picked AS p
     WHERE i.id = p.picked_id
     RETURNING i.id           AS out_item_id,
               i.provider_ref AS out_provider_ref,
               i.claim_token  AS out_claim_token,
               i.attempts     AS out_attempts
  )
  SELECT u.out_item_id, u.out_provider_ref, u.out_claim_token, u.out_attempts
    FROM updated AS u;
END;
$function$;

CREATE OR REPLACE FUNCTION public.import_canonical_v2_store_chunk(
  _batch_id uuid,
  _claim_token uuid,
  _entries jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner        uuid;
  v_expected     integer;
  v_got          integer;
  v_entry        jsonb;
  v_item_id      uuid;
  v_kind         text;
  v_error        text;
  v_msg          text;
  v_snap         jsonb;
  v_cutoff       timestamptz := now() - interval '5 minutes';
  v_token_rows   integer;
  v_token_active integer;
  v_ids          uuid[];
BEGIN
  IF _claim_token IS NULL THEN
    RAISE EXCEPTION 'invalid_canonical_payload: claim_token is required'
      USING ERRCODE = '22023';
  END IF;
  IF _entries IS NULL OR jsonb_typeof(_entries) <> 'array' THEN
    RAISE EXCEPTION 'invalid_canonical_payload: entries must be an array'
      USING ERRCODE = '22023';
  END IF;
  v_expected := jsonb_array_length(_entries);
  IF v_expected < 1 OR v_expected > 50 THEN
    RAISE EXCEPTION 'invalid_canonical_payload: chunk size out of range [1..50]'
      USING ERRCODE = '22023';
  END IF;

  SELECT b.user_id INTO v_owner
    FROM public.import_canonical_v2_batches AS b
   WHERE b.id = _batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'batch_not_found' USING ERRCODE = '02000';
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE i.claimed_at IS NOT NULL AND i.claimed_at > v_cutoff)
    INTO v_token_rows, v_token_active
    FROM public.import_canonical_v2_items AS i
   WHERE i.batch_id    = _batch_id
     AND i.user_id     = v_owner
     AND i.status      = 'claimed'
     AND i.claim_token = _claim_token;

  IF v_token_rows = 0 THEN
    RAISE EXCEPTION 'invalid_claim_token' USING ERRCODE = '22023';
  END IF;
  IF v_token_active <> v_token_rows THEN
    RAISE EXCEPTION 'claim_expired' USING ERRCODE = '55000';
  END IF;

  SELECT array_agg((e->>'item_id')::uuid)
    INTO v_ids
    FROM jsonb_array_elements(_entries) AS e;
  IF v_ids IS NULL OR array_length(v_ids,1) <> v_expected THEN
    RAISE EXCEPTION 'invalid_canonical_payload: missing item_id' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(v_ids) AS x) <> v_expected THEN
    RAISE EXCEPTION 'invalid_canonical_payload: duplicate item_id in entries'
      USING ERRCODE='22023';
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

      UPDATE public.import_canonical_v2_items AS i
         SET status             = 'canonical',
             canonical_snapshot = v_snap,
             error_code         = NULL,
             error_message      = NULL,
             claim_token        = NULL,
             claimed_at         = NULL,
             updated_at         = now()
       WHERE i.id          = v_item_id
         AND i.batch_id    = _batch_id
         AND i.user_id     = v_owner
         AND i.status      = 'claimed'
         AND i.claim_token = _claim_token
         AND i.claimed_at IS NOT NULL
         AND i.claimed_at  > v_cutoff;
    ELSE
      v_error := NULLIF(v_entry->>'error_code','');
      v_msg   := NULLIF(v_entry->>'error_message','');
      IF v_error IS NULL THEN
        RAISE EXCEPTION 'invalid_canonical_payload: failed entry needs error_code'
          USING ERRCODE = '22023';
      END IF;
      IF v_error IN ('provider_rate_limited','provider_timeout','provider_unavailable') THEN
        UPDATE public.import_canonical_v2_items AS i
           SET status        = 'failed',
               error_code    = v_error,
               error_message = v_msg,
               claim_token   = NULL,
               claimed_at    = NULL,
               updated_at    = now()
         WHERE i.id          = v_item_id
           AND i.batch_id    = _batch_id
           AND i.user_id     = v_owner
           AND i.status      = 'claimed'
           AND i.claim_token = _claim_token
           AND i.claimed_at IS NOT NULL
           AND i.claimed_at  > v_cutoff
           AND i.attempts   >= 5;
      ELSE
        UPDATE public.import_canonical_v2_items AS i
           SET status        = 'failed',
               error_code    = v_error,
               error_message = v_msg,
               claim_token   = NULL,
               claimed_at    = NULL,
               updated_at    = now()
         WHERE i.id          = v_item_id
           AND i.batch_id    = _batch_id
           AND i.user_id     = v_owner
           AND i.status      = 'claimed'
           AND i.claim_token = _claim_token
           AND i.claimed_at IS NOT NULL
           AND i.claimed_at  > v_cutoff;
      END IF;
    END IF;

    IF FOUND THEN
      v_got := v_got + 1;
    END IF;
  END LOOP;

  IF v_got <> v_expected THEN
    RAISE EXCEPTION 'partial_chunk_rejected: expected % writes, applied %',
      v_expected, v_got USING ERRCODE = '40001';
  END IF;

  PERFORM public.import_canonical_v2__recompute(_batch_id);
  RETURN jsonb_build_object('stored', v_got);
END;
$function$;

CREATE OR REPLACE FUNCTION public.import_canonical_v2_release_lock(
  _batch_id uuid,
  _claim_token uuid,
  _error_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner    uuid;
  v_released integer;
  v_totals   record;
BEGIN
  IF _claim_token IS NULL THEN
    RAISE EXCEPTION 'invalid_canonical_payload: claim_token is required'
      USING ERRCODE='22023';
  END IF;
  IF _error_code IS NULL
     OR _error_code NOT IN ('provider_rate_limited','provider_timeout','provider_unavailable') THEN
    RAISE EXCEPTION 'invalid_canonical_payload: release_lock accepts only retryable error codes'
      USING ERRCODE='22023';
  END IF;

  SELECT b.user_id INTO v_owner
    FROM public.import_canonical_v2_batches AS b
   WHERE b.id = _batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'batch_not_found' USING ERRCODE='02000';
  END IF;

  UPDATE public.import_canonical_v2_items AS i
     SET status      = CASE WHEN i.attempts >= 5 THEN 'failed' ELSE 'pending' END,
         claim_token = NULL,
         claimed_at  = NULL,
         error_code  = _error_code,
         updated_at  = now()
   WHERE i.batch_id    = _batch_id
     AND i.user_id     = v_owner
     AND i.status      = 'claimed'
     AND i.claim_token = _claim_token;
  GET DIAGNOSTICS v_released = ROW_COUNT;

  IF v_released = 0 THEN
    RAISE EXCEPTION 'invalid_claim_token' USING ERRCODE='22023';
  END IF;

  PERFORM public.import_canonical_v2__recompute(_batch_id);

  SELECT b.status,
         b.total_count,
         b.canonical_count,
         b.failed_count,
         b.skipped_count,
         b.applied_count
    INTO v_totals
    FROM public.import_canonical_v2_batches AS b
   WHERE b.id = _batch_id;

  RETURN jsonb_build_object(
    'released',        v_released,
    'batch_status',    v_totals.status,
    'total_count',     v_totals.total_count,
    'canonical_count', v_totals.canonical_count,
    'failed_count',    v_totals.failed_count,
    'skipped_count',   v_totals.skipped_count,
    'applied_count',   v_totals.applied_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.import_canonical_v2_claim_chunk(uuid, integer)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.import_canonical_v2_store_chunk(uuid, uuid, jsonb)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.import_canonical_v2_release_lock(uuid, uuid, text)  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.import_canonical_v2_claim_chunk(uuid, integer)     TO service_role;
GRANT EXECUTE ON FUNCTION public.import_canonical_v2_store_chunk(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.import_canonical_v2_release_lock(uuid, uuid, text) TO service_role;

COMMIT;