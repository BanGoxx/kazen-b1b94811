CREATE TABLE public.member_email_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  receive_general_digest boolean NOT NULL DEFAULT false,
  receive_personalized_digest boolean NOT NULL DEFAULT false,
  digest_frequency text NOT NULL DEFAULT 'weekly' CHECK (digest_frequency IN ('weekly','monthly','never')),
  preferred_content_types text[] NOT NULL DEFAULT ARRAY['anime','films','series','articles']::text[],
  preferred_genres text[] NULL,
  preferred_platforms text[] NULL,
  include_upcoming boolean NOT NULL DEFAULT true,
  include_articles boolean NOT NULL DEFAULT true,
  include_recommendations boolean NOT NULL DEFAULT true,
  last_digest_preview_at timestamptz NULL,
  consent_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_email_preferences TO authenticated;
GRANT ALL ON public.member_email_preferences TO service_role;

ALTER TABLE public.member_email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage their own email preferences"
ON public.member_email_preferences
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_member_email_preferences_updated_at
BEFORE UPDATE ON public.member_email_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();