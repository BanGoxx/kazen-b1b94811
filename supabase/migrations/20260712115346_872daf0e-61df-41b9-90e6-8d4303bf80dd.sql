-- KAZEN Data Enrichment Layer — Phase 1 (additive only, non-destructive)

CREATE TABLE public.media_enrichments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL,
  external_id text NOT NULL,
  title_override text,
  native_title_override text,
  synopsis_override text,
  poster_url_override text,
  backdrop_url_override text,
  status_note text,
  data_quality_status text NOT NULL DEFAULT 'needs_review'
    CHECK (data_quality_status IN ('complete','partial','provider_limited','needs_review')),
  enrichment_notes text,
  extra_titles jsonb,
  extra_relations jsonb,
  extra_characters jsonb,
  extra_staff jsonb,
  extra_sources jsonb,
  extra_platforms jsonb,
  external_links jsonb,
  qa_flags jsonb,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_enrichments TO authenticated;
GRANT ALL ON public.media_enrichments TO service_role;

ALTER TABLE public.media_enrichments ENABLE ROW LEVEL SECURITY;

-- Owner-only writes/reads on the raw table (private notes protected).
CREATE POLICY "Owner manages enrichments"
  ON public.media_enrichments FOR ALL
  TO authenticated
  USING (public.can_moderate_now(auth.uid()))
  WITH CHECK (public.can_moderate_now(auth.uid()));

CREATE TRIGGER update_media_enrichments_updated_at
  BEFORE UPDATE ON public.media_enrichments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public read of SAFE, published enrichment fields only (never private notes).
CREATE OR REPLACE FUNCTION public.get_public_enrichment(_source text, _external_id text)
RETURNS TABLE(
  source text,
  external_id text,
  title_override text,
  native_title_override text,
  synopsis_override text,
  poster_url_override text,
  backdrop_url_override text,
  status_note text,
  data_quality_status text,
  extra_titles jsonb,
  extra_relations jsonb,
  extra_characters jsonb,
  extra_staff jsonb,
  extra_sources jsonb,
  extra_platforms jsonb,
  external_links jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.source, e.external_id, e.title_override, e.native_title_override,
    e.synopsis_override, e.poster_url_override, e.backdrop_url_override,
    e.status_note, e.data_quality_status, e.extra_titles, e.extra_relations,
    e.extra_characters, e.extra_staff, e.extra_sources, e.extra_platforms,
    e.external_links
  FROM public.media_enrichments e
  WHERE e.source = _source
    AND e.external_id = _external_id
    AND e.is_published = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_enrichment(text, text) TO anon, authenticated;