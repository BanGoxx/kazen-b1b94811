-- KAZEN Founder Console Phase 1 — public badges + founder identity helper

-- Helper: expose the set of founder (owner) user ids for public "Fondateur" badge
-- derivation. SECURITY DEFINER so it can read the auth-only user_roles table.
CREATE OR REPLACE FUNCTION public.founder_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.user_roles WHERE role = 'owner';
$$;
REVOKE EXECUTE ON FUNCTION public.founder_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.founder_user_ids() TO anon, authenticated;

-- Badge catalog (owner-managed identity markers, NOT permissions)
CREATE TABLE public.public_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  visual_variant text NOT NULL DEFAULT 'default',
  icon_key text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.public_badges TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_badges TO authenticated;
GRANT ALL ON public.public_badges TO service_role;
ALTER TABLE public.public_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active badges"
  ON public.public_badges FOR SELECT
  TO anon, authenticated
  USING (is_active);

CREATE POLICY "Owner manages badges"
  ON public.public_badges FOR ALL
  TO authenticated
  USING (public.can_moderate_now(auth.uid()))
  WITH CHECK (public.can_moderate_now(auth.uid()));

-- Badge assignments to users
CREATE TABLE public.user_public_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.public_badges(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  is_visible boolean NOT NULL DEFAULT true,
  UNIQUE (user_id, badge_id)
);
GRANT SELECT ON public.user_public_badges TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_public_badges TO authenticated;
GRANT ALL ON public.user_public_badges TO service_role;
ALTER TABLE public.user_public_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read visible assignments"
  ON public.user_public_badges FOR SELECT
  TO anon, authenticated
  USING (is_visible);

CREATE POLICY "Owner manages assignments"
  ON public.user_public_badges FOR ALL
  TO authenticated
  USING (public.can_moderate_now(auth.uid()))
  WITH CHECK (public.can_moderate_now(auth.uid()));

-- updated_at trigger for badges
CREATE TRIGGER update_public_badges_updated_at
  BEFORE UPDATE ON public.public_badges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();