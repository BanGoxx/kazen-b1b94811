-- Phase 11.1 — Remove blanket public read on forum-covers bucket.
-- Cover URL signing now happens exclusively server-side (service role) after
-- the server verifies the requester may view the linked topic. Owner-scoped
-- INSERT/UPDATE/DELETE policies remain intact; no bucket rename, no data loss.
DROP POLICY IF EXISTS "forum-covers public read" ON storage.objects;