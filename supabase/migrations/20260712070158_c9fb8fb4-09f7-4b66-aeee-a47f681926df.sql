-- 1) Role enum ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM (
      'owner',
      'admin',
      'moderator',
      'editorial_contributor',
      'trusted_member',
      'member'
    );
  END IF;
END$$;

-- 2) user_roles table --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Hard guarantee: at most ONE owner row can ever exist.
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_owner
  ON public.user_roles ((role))
  WHERE role = 'owner';

-- Grants (Data API). Auth-only table; no anon access.
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3) Role-check helpers (SECURITY DEFINER, avoid RLS recursion) ---------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Numeric rank for least-privilege comparisons.
CREATE OR REPLACE FUNCTION public.role_rank(_role public.app_role)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'owner' THEN 100
    WHEN 'admin' THEN 80
    WHEN 'moderator' THEN 60
    WHEN 'editorial_contributor' THEN 50
    WHEN 'trusted_member' THEN 30
    WHEN 'member' THEN 10
    ELSE 0
  END;
$$;

-- 4) RLS: read-only from the client; writes go through controlled functions ---
DROP POLICY IF EXISTS "read own or elevated roles" ON public.user_roles;
CREATE POLICY "read own or elevated roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
  );
-- Note: no INSERT/UPDATE/DELETE policies -> the app cannot mutate roles
-- directly. All changes flow through grant_role / revoke_role below.

-- 5) Immutable-owner trigger (defense in depth, runs for every caller) --------
CREATE OR REPLACE FUNCTION public.protect_owner_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'owner' THEN
      RAISE EXCEPTION 'The owner role cannot be revoked.';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'owner' AND NEW.role <> 'owner' THEN
      RAISE EXCEPTION 'The owner cannot be demoted.';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_owner_role ON public.user_roles;
CREATE TRIGGER trg_protect_owner_role
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_owner_role();

-- 6) Controlled grant / revoke (enforce hierarchy via auth.uid()) ------------
CREATE OR REPLACE FUNCTION public.grant_role(_target uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  caller_is_owner boolean;
  caller_is_admin boolean;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF _role = 'owner' THEN
    RAISE EXCEPTION 'The owner role cannot be granted.';
  END IF;

  caller_is_owner := public.has_role(caller, 'owner');
  caller_is_admin := public.has_role(caller, 'admin');

  IF _role = 'admin' AND NOT caller_is_owner THEN
    RAISE EXCEPTION 'Only the owner can grant the admin role.';
  END IF;

  IF NOT (caller_is_owner OR caller_is_admin) THEN
    RAISE EXCEPTION 'Insufficient privileges to grant roles.';
  END IF;

  INSERT INTO public.user_roles (user_id, role, granted_by)
  VALUES (_target, _role, caller)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_role(_target uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  caller_is_owner boolean;
  caller_is_admin boolean;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF _role = 'owner' THEN
    RAISE EXCEPTION 'The owner role cannot be revoked.';
  END IF;

  caller_is_owner := public.has_role(caller, 'owner');
  caller_is_admin := public.has_role(caller, 'admin');

  IF _role = 'admin' AND NOT caller_is_owner THEN
    RAISE EXCEPTION 'Only the owner can revoke the admin role.';
  END IF;

  IF NOT (caller_is_owner OR caller_is_admin) THEN
    RAISE EXCEPTION 'Insufficient privileges to revoke roles.';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _target AND role = _role;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_role(uuid, public.app_role) FROM public;
REVOKE ALL ON FUNCTION public.revoke_role(uuid, public.app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.grant_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.role_rank(public.app_role) TO authenticated, anon;

-- 7) Seed the sole existing account as the unique platform Owner -------------
INSERT INTO public.user_roles (user_id, role)
SELECT '032fdd82-f3bf-4a8e-a7be-c84b7f7870ce', 'owner'
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner');