CREATE TABLE public.recommendation_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_key TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'hidden' CHECK (action IN ('hidden', 'not_interested')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, media_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendation_feedback TO authenticated;
GRANT ALL ON public.recommendation_feedback TO service_role;

ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own reco feedback"
  ON public.recommendation_feedback
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_reco_feedback_user ON public.recommendation_feedback (user_id);

-- Owner/moderator aggregate diagnostics (no per-user data exposed).
CREATE OR REPLACE FUNCTION public.reco_feedback_stats()
RETURNS TABLE (action TEXT, total BIGINT, distinct_media BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rf.action, count(*)::bigint AS total, count(DISTINCT rf.media_key)::bigint AS distinct_media
  FROM public.recommendation_feedback rf
  WHERE public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin')
  GROUP BY rf.action
$$;