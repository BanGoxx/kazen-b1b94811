CREATE TYPE public.playlist_request_status AS ENUM ('pending','accepted','declined','cancelled');

CREATE TABLE public.playlist_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.playlist_collab_role NOT NULL DEFAULT 'editor',
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlist_collaborators TO authenticated;
GRANT ALL ON public.playlist_collaborators TO service_role;
ALTER TABLE public.playlist_collaborators ENABLE ROW LEVEL SECURITY;
CREATE INDEX playlist_collaborators_user_idx ON public.playlist_collaborators(user_id);