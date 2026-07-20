-- Rollback G.6E1 : supprime uniquement le trigger si sa définition correspond.
DO $$
DECLARE
  v_def text;
  v_expected text := 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()';
BEGIN
  SELECT pg_get_triggerdef(t.oid) INTO v_def
  FROM pg_trigger t
  WHERE t.tgname = 'on_auth_user_created' AND t.tgrelid = 'auth.users'::regclass;
  IF v_def = v_expected THEN
    DROP TRIGGER on_auth_user_created ON auth.users;
  END IF;
END $$;
