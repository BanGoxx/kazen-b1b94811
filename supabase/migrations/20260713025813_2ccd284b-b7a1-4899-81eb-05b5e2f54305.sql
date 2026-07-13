CREATE TABLE public.weekly_recap_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_recap_reads TO authenticated;
GRANT ALL ON public.weekly_recap_reads TO service_role;

ALTER TABLE public.weekly_recap_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage their own recap read state"
  ON public.weekly_recap_reads
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);