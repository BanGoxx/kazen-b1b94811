
-- Enums
CREATE TYPE public.watch_status AS ENUM ('a_voir','en_cours','termine','en_pause','abandonne');
CREATE TYPE public.priority_level AS ENUM ('basse','normale','haute');

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ MEDIA RECORDS (shared metadata cache) ============
CREATE TABLE public.media_records (
  media_key TEXT NOT NULL PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  title TEXT NOT NULL,
  title_original TEXT,
  poster_url TEXT,
  backdrop_url TEXT,
  release_date TEXT,
  genres TEXT[] NOT NULL DEFAULT '{}',
  platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.media_records TO authenticated;
GRANT SELECT ON public.media_records TO anon;
GRANT ALL ON public.media_records TO service_role;
ALTER TABLE public.media_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Media records are viewable by everyone" ON public.media_records FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add media records" ON public.media_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can refresh media records" ON public.media_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_media_records_updated_at BEFORE UPDATE ON public.media_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ LIST ITEMS (personal user data) ============
CREATE TABLE public.list_items (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  media_key TEXT NOT NULL REFERENCES public.media_records(media_key) ON DELETE CASCADE,
  status public.watch_status,
  favorite BOOLEAN NOT NULL DEFAULT false,
  priority public.priority_level NOT NULL DEFAULT 'normale',
  rating SMALLINT CHECK (rating >= 1 AND rating <= 10),
  notes TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, media_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_items TO authenticated;
GRANT ALL ON public.list_items TO service_role;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own list items" ON public.list_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add their own list items" ON public.list_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own list items" ON public.list_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own list items" ON public.list_items FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_list_items_updated_at BEFORE UPDATE ON public.list_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_list_items_user ON public.list_items(user_id);
CREATE INDEX idx_list_items_media ON public.list_items(media_key);
