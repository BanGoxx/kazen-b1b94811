BEGIN;

ALTER TABLE public.app_feature_flags
  ADD COLUMN allowed_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE OR REPLACE FUNCTION public.import_canonical_v2_is_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT f.enabled
             AND auth.uid() IS NOT NULL
             AND auth.uid() = ANY(f.allowed_user_ids)
      FROM public.app_feature_flags f
      WHERE f.flag_key = 'IMPORT_CANONICALIZATION_V2'
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.import_canonical_v2_is_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_canonical_v2_is_enabled() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.import_canonical_v2__is_enabled_for_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT f.enabled
             AND _user_id IS NOT NULL
             AND _user_id = ANY(f.allowed_user_ids)
      FROM public.app_feature_flags f
      WHERE f.flag_key = 'IMPORT_CANONICALIZATION_V2'
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.import_canonical_v2__is_enabled_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_canonical_v2__is_enabled_for_user(uuid) TO service_role;

COMMIT;