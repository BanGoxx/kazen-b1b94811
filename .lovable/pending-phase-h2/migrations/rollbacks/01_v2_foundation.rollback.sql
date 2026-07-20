-- KAZEN STAGING — Rollback for Import Canonicalization V2 (non-automatic).
-- Apply ONLY manually if the V2 checkpoint must be undone.
-- Since the preflight proved app_feature_flags did NOT exist prior to the V2
-- checkpoint, this rollback DROPs the table (with its dependents) to restore
-- the exact pre-checkpoint state. It does not touch any V1 objects.
--
-- Run inside a transaction if desired:
--   BEGIN;
--     \i .lovable/rollback-import-canonicalization-v2.sql
--   COMMIT;

-- 1. Drop RPCs (exact signatures).
DROP FUNCTION IF EXISTS public.import_canonical_v2_skip_failed(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.import_canonical_v2_release_lock(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.import_canonical_v2_rollback(uuid);
DROP FUNCTION IF EXISTS public.import_canonical_v2_confirm(uuid);
DROP FUNCTION IF EXISTS public.import_canonical_v2_progress(uuid);
DROP FUNCTION IF EXISTS public.import_canonical_v2_store_chunk(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.import_canonical_v2_claim_chunk(uuid, int);
DROP FUNCTION IF EXISTS public.import_canonical_v2_preview(uuid);
DROP FUNCTION IF EXISTS public.import_canonical_v2_create_batch(jsonb);
DROP FUNCTION IF EXISTS public.import_canonical_v2_is_enabled();

-- 2. Drop helpers.
DROP FUNCTION IF EXISTS public.import_canonical_v2__recompute(uuid);
DROP FUNCTION IF EXISTS public.import_canonical_v2_validate_snapshot(jsonb);
DROP FUNCTION IF EXISTS public.import_canonical_v2_validate_user_action(jsonb);
DROP FUNCTION IF EXISTS public.import_canonical_v2_build_canonical(jsonb);
DROP FUNCTION IF EXISTS public.import_canonical_v2__require_string_array(text, jsonb);

-- 3. Drop V2 tables (items first because of composite FK).
DROP TABLE IF EXISTS public.import_canonical_v2_items;
DROP TABLE IF EXISTS public.import_canonical_v2_batches;

-- 4. Drop the flag row, then the flag table (created by this checkpoint).
DELETE FROM public.app_feature_flags WHERE flag_key = 'IMPORT_CANONICALIZATION_V2';
DROP TABLE public.app_feature_flags;

-- 5. Restore seed helpers to their pre-migration ACL (they were PUBLIC/anon
--    accessible on staging, per the preflight audit). This preserves the
--    exact pre-checkpoint state on staging. Adjust manually if you also want
--    to keep the staging hardening applied by the migration.
GRANT EXECUTE ON FUNCTION public.seed_media_snapshot(
  _media_key text, _source text, _external_id text, _media_type text, _title text,
  _title_original text, _poster_url text, _backdrop_url text, _release_date text,
  _genres text[], _platforms jsonb, _score numeric
) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.seed_media_snapshot_for_batch(
  _batch_id uuid, _media_key text, _source text, _external_id text, _media_type text,
  _title text, _title_original text, _poster_url text, _backdrop_url text,
  _release_date text, _genres text[], _platforms jsonb, _score numeric
) TO PUBLIC;
