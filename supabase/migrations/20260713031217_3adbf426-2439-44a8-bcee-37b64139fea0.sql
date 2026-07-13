CREATE TABLE public.playlist_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.playlist_request_status NOT NULL DEFAULT 'pending',
  message text NOT NULL DEFAULT '',
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlist_requests TO authenticated;
GRANT ALL ON public.playlist_requests TO service_role;
ALTER TABLE public.playlist_requests ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX playlist_requests_pending_uidx ON public.playlist_requests(playlist_id, requester_id) WHERE status = 'pending';
CREATE INDEX playlist_requests_playlist_idx ON public.playlist_requests(playlist_id);
CREATE TRIGGER update_playlist_requests_updated_at BEFORE UPDATE ON public.playlist_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();