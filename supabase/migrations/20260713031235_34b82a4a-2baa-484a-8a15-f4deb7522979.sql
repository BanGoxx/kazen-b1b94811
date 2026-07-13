CREATE OR REPLACE FUNCTION public.is_playlist_collaborator(_playlist uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.playlist_collaborators
    WHERE playlist_id = _playlist AND user_id = _user
  );
$fn$;

CREATE OR REPLACE FUNCTION public.is_playlist_editor(_playlist uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.playlists p
    WHERE p.id = _playlist AND p.owner_id = _user
  ) OR EXISTS (
    SELECT 1 FROM public.playlist_collaborators c
    WHERE c.playlist_id = _playlist AND c.user_id = _user AND c.role = 'editor'
  );
$fn$;