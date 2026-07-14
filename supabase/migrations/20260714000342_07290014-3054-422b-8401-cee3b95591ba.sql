-- playlist_collaborators: re-scope all policies to authenticated
DROP POLICY "Owner and self can view collaborators" ON public.playlist_collaborators;
CREATE POLICY "Owner and self can view collaborators" ON public.playlist_collaborators
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM playlists p
    WHERE ((p.id = playlist_collaborators.playlist_id) AND (p.owner_id = auth.uid())))) OR is_moderator(auth.uid()));

DROP POLICY "Owner manages collaborators insert" ON public.playlist_collaborators;
CREATE POLICY "Owner manages collaborators insert" ON public.playlist_collaborators
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1 FROM playlists p
    WHERE ((p.id = playlist_collaborators.playlist_id) AND (p.owner_id = auth.uid()))));

DROP POLICY "Owner manages collaborators update" ON public.playlist_collaborators;
CREATE POLICY "Owner manages collaborators update" ON public.playlist_collaborators
  FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1 FROM playlists p
    WHERE ((p.id = playlist_collaborators.playlist_id) AND (p.owner_id = auth.uid()))));

DROP POLICY "Owner or self can remove collaborator" ON public.playlist_collaborators;
CREATE POLICY "Owner or self can remove collaborator" ON public.playlist_collaborators
  FOR DELETE TO authenticated
  USING ((user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM playlists p
    WHERE ((p.id = playlist_collaborators.playlist_id) AND (p.owner_id = auth.uid())))));

-- playlist_requests: re-scope all policies to authenticated
DROP POLICY "Members can request to join" ON public.playlist_requests;
CREATE POLICY "Members can request to join" ON public.playlist_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

DROP POLICY "Owner or requester can update request" ON public.playlist_requests;
CREATE POLICY "Owner or requester can update request" ON public.playlist_requests
  FOR UPDATE TO authenticated
  USING ((requester_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM playlists p
    WHERE ((p.id = playlist_requests.playlist_id) AND (p.owner_id = auth.uid())))));

DROP POLICY "Owner requester moderator can view requests" ON public.playlist_requests;
CREATE POLICY "Owner requester moderator can view requests" ON public.playlist_requests
  FOR SELECT TO authenticated
  USING ((requester_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM playlists p
    WHERE ((p.id = playlist_requests.playlist_id) AND (p.owner_id = auth.uid())))) OR is_moderator(auth.uid()));

-- playlist_items: re-scope editor write policies to authenticated
-- (public SELECT policies for anonymous browsing are intentionally left unchanged)
DROP POLICY "Editors can add playlist items" ON public.playlist_items;
CREATE POLICY "Editors can add playlist items" ON public.playlist_items
  FOR INSERT TO authenticated
  WITH CHECK ((hidden_at IS NULL) AND (deleted_at IS NULL) AND is_playlist_editor(playlist_id, auth.uid()));

DROP POLICY "Editors can update playlist items" ON public.playlist_items;
CREATE POLICY "Editors can update playlist items" ON public.playlist_items
  FOR UPDATE TO authenticated
  USING ((hidden_at IS NULL) AND (deleted_at IS NULL) AND is_playlist_editor(playlist_id, auth.uid()));

DROP POLICY "Editors can delete playlist items" ON public.playlist_items;
CREATE POLICY "Editors can delete playlist items" ON public.playlist_items
  FOR DELETE TO authenticated
  USING ((hidden_at IS NULL) AND (deleted_at IS NULL) AND is_playlist_editor(playlist_id, auth.uid()));

-- playlist_items: collaborator-only SELECT (collaborators are always authenticated)
DROP POLICY "Collaborators can view playlist items" ON public.playlist_items;
CREATE POLICY "Collaborators can view playlist items" ON public.playlist_items
  FOR SELECT TO authenticated
  USING ((hidden_at IS NULL) AND (deleted_at IS NULL) AND is_playlist_collaborator(playlist_id, auth.uid()));