CREATE TABLE public.fiche_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_source text NOT NULL,
  media_external_id text NOT NULL,
  body text NOT NULL,
  rating smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, media_source, media_external_id)
);

CREATE INDEX idx_fiche_reviews_media ON public.fiche_reviews (media_source, media_external_id, created_at DESC);

GRANT SELECT ON public.fiche_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiche_reviews TO authenticated;
GRANT ALL ON public.fiche_reviews TO service_role;

ALTER TABLE public.fiche_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reviews"
  ON public.fiche_reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own reviews"
  ON public.fiche_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND char_length(body) BETWEEN 1 AND 4000 AND (rating IS NULL OR rating BETWEEN 0 AND 10) AND media_source IN ('anilist','tmdb_tv','tmdb_movie'));

CREATE POLICY "Users can update their own reviews"
  ON public.fiche_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND char_length(body) BETWEEN 1 AND 4000 AND (rating IS NULL OR rating BETWEEN 0 AND 10));

CREATE POLICY "Users can delete their own reviews"
  ON public.fiche_reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_fiche_reviews_updated_at
  BEFORE UPDATE ON public.fiche_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();