CREATE OR REPLACE FUNCTION public.role_diag()
RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
GRANT EXECUTE ON FUNCTION public.role_diag() TO anon, authenticated, service_role;