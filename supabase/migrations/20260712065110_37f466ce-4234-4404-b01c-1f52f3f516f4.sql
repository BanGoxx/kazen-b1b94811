-- Remove any orphan items that have no matching media snapshot (defensive;
-- addItem always upserts a snapshot first, so this should affect nothing).
DELETE FROM public.playlist_items pi
WHERE NOT EXISTS (
  SELECT 1 FROM public.media_records mr WHERE mr.media_key = pi.media_key
);

ALTER TABLE public.playlist_items
  ADD CONSTRAINT playlist_items_media_key_fkey
  FOREIGN KEY (media_key) REFERENCES public.media_records(media_key) ON DELETE CASCADE;