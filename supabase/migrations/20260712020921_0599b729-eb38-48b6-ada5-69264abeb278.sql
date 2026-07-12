CREATE TABLE public.playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.playlists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;
GRANT ALL ON public.playlists TO service_role;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public playlists are readable by everyone" ON public.playlists
  FOR SELECT USING (is_public OR auth.uid() = owner_id);
CREATE POLICY "Users can create their playlists" ON public.playlists
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update their playlists" ON public.playlists
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can delete their playlists" ON public.playlists
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.playlist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  media_key TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, media_key)
);
GRANT SELECT ON public.playlist_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlist_items TO authenticated;
GRANT ALL ON public.playlist_items TO service_role;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Playlist items follow playlist visibility" ON public.playlist_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.playlists p
    WHERE p.id = playlist_id AND (p.is_public OR p.owner_id = auth.uid())
  ));
CREATE POLICY "Owners can add playlist items" ON public.playlist_items
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.playlists p
    WHERE p.id = playlist_id AND p.owner_id = auth.uid()
  ));
CREATE POLICY "Owners can update playlist items" ON public.playlist_items
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.playlists p
    WHERE p.id = playlist_id AND p.owner_id = auth.uid()
  ));
CREATE POLICY "Owners can delete playlist items" ON public.playlist_items
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.playlists p
    WHERE p.id = playlist_id AND p.owner_id = auth.uid()
  ));