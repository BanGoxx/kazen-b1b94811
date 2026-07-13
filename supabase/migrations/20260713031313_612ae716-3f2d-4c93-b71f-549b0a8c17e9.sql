-- playlist_collaborators policies
CREATE POLICY "Owner and self can view collaborators" ON public.playlist_collaborators
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.owner_id = auth.uid())
  OR public.is_moderator(auth.uid())
);
CREATE POLICY "Owner manages collaborators insert" ON public.playlist_collaborators
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.owner_id = auth.uid())
);
CREATE POLICY "Owner manages collaborators update" ON public.playlist_collaborators
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.owner_id = auth.uid())
);
CREATE POLICY "Owner or self can remove collaborator" ON public.playlist_collaborators
FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.owner_id = auth.uid())
);

-- playlist_requests policies
CREATE POLICY "Owner requester moderator can view requests" ON public.playlist_requests
FOR SELECT USING (
  requester_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.owner_id = auth.uid())
  OR public.is_moderator(auth.uid())
);
CREATE POLICY "Members can request to join" ON public.playlist_requests
FOR INSERT WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Owner or requester can update request" ON public.playlist_requests
FOR UPDATE USING (
  requester_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.owner_id = auth.uid())
);

-- collaborator read/write on playlists and items
CREATE POLICY "Collaborators can view playlist" ON public.playlists
FOR SELECT USING (
  hidden_at IS NULL AND deleted_at IS NULL AND public.is_playlist_collaborator(id, auth.uid())
);
CREATE POLICY "Collaborators can view playlist items" ON public.playlist_items
FOR SELECT USING (
  hidden_at IS NULL AND deleted_at IS NULL AND public.is_playlist_collaborator(playlist_id, auth.uid())
);
CREATE POLICY "Editors can add playlist items" ON public.playlist_items
FOR INSERT WITH CHECK (
  hidden_at IS NULL AND deleted_at IS NULL AND public.is_playlist_editor(playlist_id, auth.uid())
);
CREATE POLICY "Editors can update playlist items" ON public.playlist_items
FOR UPDATE USING (
  hidden_at IS NULL AND deleted_at IS NULL AND public.is_playlist_editor(playlist_id, auth.uid())
);
CREATE POLICY "Editors can delete playlist items" ON public.playlist_items
FOR DELETE USING (
  hidden_at IS NULL AND deleted_at IS NULL AND public.is_playlist_editor(playlist_id, auth.uid())
);