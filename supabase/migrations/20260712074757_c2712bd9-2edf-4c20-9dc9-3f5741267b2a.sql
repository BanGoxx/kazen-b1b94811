
CREATE TABLE public.import_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('mal','anilist','nautiljon','anime_planet','simkl','kazen_csv','kazen_json')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','parsed','needs_review','ready','importing','completed','failed','rolled_back')),
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE public.import_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_ref text,
  raw_title text NOT NULL,
  normalized_title text,
  alt_titles text[] NOT NULL DEFAULT '{}',
  media_type text,
  release_year integer,
  total_episodes integer,
  user_status text,
  user_score numeric,
  progress integer,
  started_at date,
  completed_at date,
  notes text,
  matched_media_key text,
  match_confidence numeric,
  match_status text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('exact','probable','needs_confirmation','unmatched','duplicate')),
  import_action text NOT NULL DEFAULT 'skip' CHECK (import_action IN ('create','update','skip','needs_user_choice')),
  applied_action text CHECK (applied_action IN ('created','updated','skipped')),
  applied_at timestamptz,
  previous_item jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_batches_user ON public.import_batches(user_id, created_at DESC);
CREATE INDEX idx_import_items_batch ON public.import_items(batch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_items TO authenticated;
GRANT ALL ON public.import_items TO service_role;

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own import batches"
  ON public.import_batches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own import items"
  ON public.import_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_import_batches_updated_at
  BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_import_items_updated_at
  BEFORE UPDATE ON public.import_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
