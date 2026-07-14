-- KAZEN — Phase 26.1R
-- Versionnage additif de public.account_deletion_requests (la table existe
-- déjà dans la shared database ; cette migration synchronise le dépôt sans
-- perte de données). Ajoute également un index unique partiel garantissant
-- l'absence de doublons de demandes 'pending' par utilisateur.

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'account_deletion_requests_status_check'
  ) THEN
    ALTER TABLE public.account_deletion_requests
      ADD CONSTRAINT account_deletion_requests_status_check
      CHECK (status IN ('pending', 'processed', 'cancelled'));
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;

CREATE INDEX IF NOT EXISTS idx_adr_user ON public.account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_adr_status
  ON public.account_deletion_requests(status)
  WHERE status = 'pending';

-- Nouveau : empêcher plusieurs demandes 'pending' pour le même utilisateur.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_adr_pending_per_user
  ON public.account_deletion_requests(user_id)
  WHERE status = 'pending';

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user creates own deletion request" ON public.account_deletion_requests;
CREATE POLICY "user creates own deletion request"
  ON public.account_deletion_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "user reads own deletion requests" ON public.account_deletion_requests;
CREATE POLICY "user reads own deletion requests"
  ON public.account_deletion_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "user cancels own pending request" ON public.account_deletion_requests;
CREATE POLICY "user cancels own pending request"
  ON public.account_deletion_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'cancelled'));

DROP POLICY IF EXISTS "owner processes any request" ON public.account_deletion_requests;
CREATE POLICY "owner processes any request"
  ON public.account_deletion_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

DROP TRIGGER IF EXISTS trg_adr_updated_at ON public.account_deletion_requests;
CREATE TRIGGER trg_adr_updated_at
  BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
