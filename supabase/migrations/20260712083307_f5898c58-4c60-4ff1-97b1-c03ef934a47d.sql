-- 1. Editorial "why I recommend" field for premium collections
ALTER TABLE public.playlists
  ADD COLUMN IF NOT EXISTS recommendation text NOT NULL DEFAULT '';

-- 2. Member "missing title" request system (beta: owner reviews)
CREATE TABLE IF NOT EXISTS public.media_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('anime','series','film')),
  external_url text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','reviewing','accepted','rejected','duplicate')),
  review_note text NOT NULL DEFAULT '',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.media_requests TO authenticated;
GRANT ALL ON public.media_requests TO service_role;

ALTER TABLE public.media_requests ENABLE ROW LEVEL SECURITY;

-- Requesters see their own requests; the Owner sees all (beta review scope)
CREATE POLICY "Requesters and owner can read media requests"
  ON public.media_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR public.has_role(auth.uid(), 'owner'));

-- Any authenticated member can submit a request for themselves
CREATE POLICY "Members can submit media requests"
  ON public.media_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

-- Only the Owner can review/update requests during beta
CREATE POLICY "Owner can review media requests"
  ON public.media_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_media_requests_updated_at
  BEFORE UPDATE ON public.media_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();