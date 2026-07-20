BEGIN;

DO $$
DECLARE
  v_def text;
  v_expected text := 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()';
BEGIN
  SELECT pg_get_triggerdef(t.oid)
    INTO v_def
  FROM pg_trigger t
  WHERE t.tgname = 'on_auth_user_created'
    AND t.tgrelid = 'auth.users'::regclass;

  IF v_def IS NULL THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  ELSIF v_def <> v_expected THEN
    RAISE EXCEPTION 'Trigger on_auth_user_created exists with a different definition: %', v_def;
  END IF;
END $$;

COMMIT;