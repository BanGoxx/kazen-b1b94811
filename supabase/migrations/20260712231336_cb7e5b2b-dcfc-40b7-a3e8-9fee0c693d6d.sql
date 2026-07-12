ALTER TABLE public.list_items
  ADD COLUMN IF NOT EXISTS progress integer,
  ADD COLUMN IF NOT EXISTS started_at date,
  ADD COLUMN IF NOT EXISTS completed_at date,
  ADD COLUMN IF NOT EXISTS rewatch_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_rewatching boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS import_provider text,
  ADD COLUMN IF NOT EXISTS import_ref text;