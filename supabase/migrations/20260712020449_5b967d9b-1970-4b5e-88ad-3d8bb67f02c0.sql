-- Likes on reviews
CREATE TABLE public.review_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.fiche_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);
GRANT SELECT ON public.review_likes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_likes TO authenticated;
GRANT ALL ON public.review_likes TO service_role;
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Review likes are publicly readable" ON public.review_likes FOR SELECT USING (true);
CREATE POLICY "Users can like reviews" ON public.review_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their like" ON public.review_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Replies on reviews
CREATE TABLE public.review_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.fiche_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.review_replies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_replies TO authenticated;
GRANT ALL ON public.review_replies TO service_role;
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Replies are publicly readable" ON public.review_replies FOR SELECT USING (true);
CREATE POLICY "Users can create replies" ON public.review_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their replies" ON public.review_replies FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their replies" ON public.review_replies FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_review_replies_updated_at BEFORE UPDATE ON public.review_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Likes on replies
CREATE TABLE public.reply_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reply_id UUID NOT NULL REFERENCES public.review_replies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (reply_id, user_id)
);
GRANT SELECT ON public.reply_likes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reply_likes TO authenticated;
GRANT ALL ON public.reply_likes TO service_role;
ALTER TABLE public.reply_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reply likes are publicly readable" ON public.reply_likes FOR SELECT USING (true);
CREATE POLICY "Users can like replies" ON public.reply_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their reply like" ON public.reply_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);