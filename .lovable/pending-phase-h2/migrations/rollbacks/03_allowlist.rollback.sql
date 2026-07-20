-- Rollback : allowlist Import Canonicalization V2.
BEGIN;

-- Restaurer is_enabled() sans allowlist (état du checkpoint initial).
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

REVOKE ALL ON FUNCTION public.import_canonical_v2_is_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_canonical_v2_is_enabled() TO authenticated, service_role;

-- Supprimer le helper interne.
DROP FUNCTION IF EXISTS public.import_canonical_v2__is_enabled_for_user(uuid);

-- Retirer la colonne allowlist.
ALTER TABLE public.app_feature_flags
  DROP COLUMN IF EXISTS allowed_user_ids;

COMMIT;
