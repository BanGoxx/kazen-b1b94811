CREATE TABLE public.beta_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('bug','suggestion','missing_title','incorrect_info','usability','other')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 5 AND 2000),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','reviewing','resolved','dismissed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.beta_feedback TO authenticated;
GRANT ALL ON public.beta_feedback TO service_role;

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own beta feedback"
  ON public.beta_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.can_moderate_now(auth.uid()));

CREATE POLICY "Members submit own beta feedback"
  ON public.beta_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner updates beta feedback"
  ON public.beta_feedback FOR UPDATE TO authenticated
  USING (public.can_moderate_now(auth.uid()))
  WITH CHECK (public.can_moderate_now(auth.uid()));

CREATE INDEX beta_feedback_status_idx ON public.beta_feedback (status, created_at DESC);
CREATE INDEX beta_feedback_user_idx ON public.beta_feedback (user_id, created_at DESC);

CREATE TRIGGER update_beta_feedback_updated_at
  BEFORE UPDATE ON public.beta_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Server-side rate limit: max 5 submissions per rolling hour per member.
CREATE OR REPLACE FUNCTION public.beta_feedback_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.beta_feedback
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '1 hour';
  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit: trop de retours envoyés récemment. Réessayez plus tard.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER beta_feedback_rate_limit_trg
  BEFORE INSERT ON public.beta_feedback
  FOR EACH ROW EXECUTE FUNCTION public.beta_feedback_rate_limit();