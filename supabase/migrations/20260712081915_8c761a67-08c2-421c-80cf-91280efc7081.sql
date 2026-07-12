-- Lock down SECURITY DEFINER functions that must never be called directly
-- via the API (triggers + internal helpers + service-role-only cache).
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_owner_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.anilist_cache_get(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.anilist_cache_put(text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anilist_cache_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.anilist_cache_put(text, jsonb, text) TO service_role;

-- Remove anonymous execute on functions intended only for signed-in users.
-- These RPCs self-check auth.uid()/role internally, so keep them for authenticated.
REVOKE EXECUTE ON FUNCTION public.is_moderator(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.grant_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_content_report(public.moderation_target_type, uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_report(uuid, public.report_status, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.moderate_content(public.moderation_target_type, uuid, public.moderation_action_type, text, text, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_moderator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_content_report(public.moderation_target_type, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_report(uuid, public.report_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_content(public.moderation_target_type, uuid, public.moderation_action_type, text, text, uuid) TO authenticated;