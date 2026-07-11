ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_genres text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS favorite_styles text[] NOT NULL DEFAULT '{}';