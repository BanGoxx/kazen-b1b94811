CREATE TABLE public.playlist_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, user_id)
);

GRANT SELECT ON public.playlist_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.playlist_likes TO authenticated;
GRANT ALL ON public.playlist_likes TO service_role;

ALTER TABLE public.playlist_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Playlist likes are publicly readable"
  ON public.playlist_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like playlists"
  ON public.playlist_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their playlist like"
  ON public.playlist_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_playlist_likes_playlist ON public.playlist_likes(playlist_id);