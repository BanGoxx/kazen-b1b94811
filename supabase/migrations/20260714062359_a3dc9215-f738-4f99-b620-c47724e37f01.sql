
CREATE TABLE public.fiche_correction_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,
  external_id text NOT NULL,
  media_title text NOT NULL DEFAULT '',
  category text NOT NULL,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'received',
  review_note text NOT NULL DEFAULT '',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiche_correction_source_len CHECK (char_length(source) <= 32),
  CONSTRAINT fiche_correction_external_len CHECK (char_length(external_id) <= 64),
  CONSTRAINT fiche_correction_title_len CHECK (char_length(media_title) <= 300),
  CONSTRAINT fiche_correction_body_len CHECK (char_length(body) <= 1200),
  CONSTRAINT fiche_correction_note_len CHECK (char_length(review_note) <= 1200),
  CONSTRAINT fiche_correction_category_chk CHECK (category IN (
    'incorrect_poster','incorrect_synopsis','missing_platform','wrong_relation',
    'incorrect_season','duplicate','missing_title','incorrect_metadata',
    'broken_trailer','other'
  )),
  CONSTRAINT fiche_correction_status_chk CHECK (status IN (
    'received','reviewing','need_info','accepted','rejected'
  ))
);

-- Duplicate submission protection: at most one OPEN request per member/fiche/category.
CREATE UNIQUE INDEX fiche_correction_open_dedup
  ON public.fiche_correction_requests (requester_id, source, external_id, category)
  WHERE status IN ('received','reviewing','need_info');

CREATE INDEX fiche_correction_status_idx
  ON public.fiche_correction_requests (status, created_at DESC);
CREATE INDEX fiche_correction_fiche_idx
  ON public.fiche_correction_requests (source, external_id);

GRANT SELECT, INSERT, UPDATE ON public.fiche_correction_requests TO authenticated;
GRANT ALL ON public.fiche_correction_requests TO service_role;

ALTER TABLE public.fiche_correction_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members submit their own correction requests"
  ON public.fiche_correction_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Requester and owner read correction requests"
  ON public.fiche_correction_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner reviews correction requests"
  ON public.fiche_correction_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- updated_at maintenance (reuse existing shared function).
CREATE TRIGGER update_fiche_correction_requests_updated_at
  BEFORE UPDATE ON public.fiche_correction_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ad-hoc rate limiting: block more than 8 submissions per member per hour.
-- Enforced server-side in a trigger so it cannot be bypassed by the client.
CREATE OR REPLACE FUNCTION public.enforce_correction_request_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.fiche_correction_requests
  WHERE requester_id = NEW.requester_id
    AND created_at > now() - interval '1 hour';
  IF recent_count >= 8 THEN
    RAISE EXCEPTION 'rate_limit_exceeded'
      USING HINT = 'Trop de demandes de correction envoyées récemment.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_correction_request_rate_limit_trg
  BEFORE INSERT ON public.fiche_correction_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_correction_request_rate_limit();
