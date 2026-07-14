-- Revoke direct read of the free-form bio column. Bio remains accessible:
-- - to its owner via the get_my_profile() SECURITY DEFINER RPC
-- - to viewers via get_public_profile(), which honors the show_bio toggle
REVOKE SELECT (bio) ON public.profiles FROM anon, authenticated;