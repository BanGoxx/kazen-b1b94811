-- Phase 11: additive cover fields on forum topics
ALTER TABLE public.forum_topics
  ADD COLUMN IF NOT EXISTS cover_image_path text,
  ADD COLUMN IF NOT EXISTS cover_image_alt  text,
  ADD COLUMN IF NOT EXISTS cover_image_source text,
  ADD COLUMN IF NOT EXISTS cover_updated_at timestamptz;

-- Author-only: set / replace / remove the cover for their OWN topic.
CREATE OR REPLACE FUNCTION public.set_forum_topic_cover(
  _topic uuid, _path text, _alt text DEFAULT NULL, _source text DEFAULT 'upload'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  a_author uuid; a_deleted timestamptz;
  p text := nullif(trim(coalesce(_path, '')), '');
  src text := lower(coalesce(_source, 'upload'));
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT author_id, deleted_at INTO a_author, a_deleted FROM public.forum_topics WHERE id = _topic;
  IF a_author IS NULL THEN RAISE EXCEPTION 'Sujet introuvable.'; END IF;
  IF a_author <> caller THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  IF a_deleted IS NOT NULL THEN RAISE EXCEPTION 'Sujet supprimé.'; END IF;

  IF p IS NULL THEN
    -- remove cover
    UPDATE public.forum_topics
      SET cover_image_path = NULL, cover_image_alt = NULL, cover_image_source = NULL,
          cover_updated_at = now(), updated_at = updated_at
      WHERE id = _topic;
    RETURN;
  END IF;

  -- validate controlled storage path (owner-scoped, no traversal, allowed ext)
  IF length(p) > 300 THEN RAISE EXCEPTION 'Chemin invalide.'; END IF;
  IF position('..' in p) > 0 THEN RAISE EXCEPTION 'Chemin invalide.'; END IF;
  IF split_part(p, '/', 1) <> caller::text THEN RAISE EXCEPTION 'Chemin non autorisé.'; END IF;
  IF lower(p) !~ '\.(jpe?g|png|webp)$' THEN RAISE EXCEPTION 'Format non supporté.'; END IF;
  IF src NOT IN ('upload','ai') THEN src := 'upload'; END IF;

  UPDATE public.forum_topics
    SET cover_image_path = p,
        cover_image_alt = left(nullif(trim(coalesce(_alt,'')),''), 300),
        cover_image_source = src,
        cover_updated_at = now(),
        updated_at = updated_at
    WHERE id = _topic;
END;
$$;

-- Moderator/Owner-only: clear an inappropriate cover (does NOT delete the thread).
CREATE OR REPLACE FUNCTION public.moderate_clear_forum_cover(_topic uuid, _note text DEFAULT '')
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  old_path text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT public.can_moderate_now(caller) THEN RAISE EXCEPTION 'Insufficient privileges.'; END IF;
  SELECT cover_image_path INTO old_path FROM public.forum_topics WHERE id = _topic;
  UPDATE public.forum_topics
    SET cover_image_path = NULL, cover_image_alt = NULL, cover_image_source = NULL,
        cover_updated_at = now()
    WHERE id = _topic;
  RETURN old_path; -- caller may remove the storage object (moderator delete policy allows it)
END;
$$;

-- Storage bucket policies (bucket row itself created via the storage tool).
-- Public read for cover images.
CREATE POLICY "forum-covers public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'forum-covers');

-- Authenticated upload into own folder only, allowed extensions only.
CREATE POLICY "forum-covers owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'forum-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(name) ~ '\.(jpe?g|png|webp)$'
  );

-- Owner may replace their own objects.
CREATE POLICY "forum-covers owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'forum-covers' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'forum-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Owner OR moderator/owner may delete.
CREATE POLICY "forum-covers owner or moderator delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'forum-covers'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_moderate_now(auth.uid())
    )
  );