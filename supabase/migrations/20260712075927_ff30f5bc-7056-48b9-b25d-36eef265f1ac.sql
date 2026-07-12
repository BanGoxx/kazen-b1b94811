ALTER TABLE public.import_items
  ADD COLUMN IF NOT EXISTS user_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rewatch_count integer,
  ADD COLUMN IF NOT EXISTS is_rewatching boolean NOT NULL DEFAULT false;