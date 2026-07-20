-- KAZEN Staging — Sécurité N1
-- Verrouille l'accès direct aux RPC notify_member / forum_notify.
-- Corps, propriétaire et search_path inchangés.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.notify_member(uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.forum_notify(uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.notify_member(uuid, text, text, text, text, text)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.forum_notify(uuid, text, text, text, text, text)
  TO service_role;

COMMIT;