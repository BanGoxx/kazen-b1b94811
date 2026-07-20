-- KAZEN Staging — Rollback ACL notify_member / forum_notify
-- Restaure les privilèges initiaux observés en préflight :
--   PUBLIC/anon/authenticated/service_role/sandbox_exec = EXECUTE
-- Ne modifie ni corps, ni owner, ni données.

BEGIN;

GRANT EXECUTE ON FUNCTION public.notify_member(uuid, text, text, text, text, text)
  TO PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.forum_notify(uuid, text, text, text, text, text)
  TO PUBLIC, anon, authenticated, service_role;

COMMIT;
