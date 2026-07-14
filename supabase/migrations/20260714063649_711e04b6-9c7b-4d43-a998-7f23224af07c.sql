
-- KAZEN Phase 22 — Community Discovery aggregate RPCs.
--
-- All community discovery reads go through SECURITY DEFINER functions that
-- return ONLY aggregate, threshold-gated, moderation-filtered results. This
-- keeps private list activity, private progress, chat, notifications and
-- personal preferences invisible while letting anonymous visitors see safe
-- aggregate signals. Functions never write, so repeated/anonymous calls cannot
-- manipulate any ranking. Unique-user counting + minimum thresholds + self-vote
-- exclusion + report exclusion provide anti-manipulation.

-- Helpful indexes for bounded time-window aggregates.
CREATE INDEX IF NOT EXISTS idx_list_items_created_at ON public.list_items (created_at);
CREATE INDEX IF NOT EXISTS idx_list_items_media_key ON public.list_items (media_key);
CREATE INDEX IF NOT EXISTS idx_playlist_likes_playlist ON public.playlist_likes (playlist_id);
CREATE INDEX IF NOT EXISTS idx_review_likes_review ON public.review_likes (review_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_target ON public.content_reports (target_id, status);

-- ---------------------------------------------------------------------------
-- 1) Popular playlists.
-- Ranking: unique likes (owner self-like excluded) with recency decay over the
-- playlist's last update, half-life ~45 days. Eligibility: public, not hidden,
-- not deleted, >= 3 visible items (quality), >= 3 unique likes (never ranked on
-- one or two actions), and no unresolved report. Owner name shown only when the
-- owner's profile is public; otherwise a generic label.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_community_popular_playlists(p_limit integer DEFAULT 8)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  owner_display_name text,
  item_count bigint,
  like_count bigint,
  updated_at timestamptz,
  covers text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.title, s.description, s.owner_display_name,
         s.item_count, s.like_count, s.updated_at, s.covers
  FROM (
    SELECT
      p.id,
      p.title,
      p.description,
      CASE WHEN pr.profile_public IS TRUE AND pr.display_name IS NOT NULL
           THEN pr.display_name ELSE 'Membre KAZEN' END AS owner_display_name,
      (SELECT count(*) FROM playlist_items pi
        WHERE pi.playlist_id = p.id AND pi.hidden_at IS NULL AND pi.deleted_at IS NULL) AS item_count,
      (SELECT count(DISTINCT pl.user_id) FROM playlist_likes pl
        WHERE pl.playlist_id = p.id AND pl.user_id <> p.owner_id) AS like_count,
      p.updated_at,
      (SELECT array_remove(array_agg(x.poster_url ORDER BY x.position), NULL) FROM (
        SELECT mr.poster_url, pi.position
        FROM playlist_items pi
        JOIN media_records mr ON mr.media_key = pi.media_key
        WHERE pi.playlist_id = p.id AND pi.hidden_at IS NULL AND pi.deleted_at IS NULL
          AND mr.poster_url IS NOT NULL
        ORDER BY pi.position LIMIT 4) x) AS covers
    FROM playlists p
    LEFT JOIN profiles pr ON pr.id = p.owner_id
    WHERE p.is_public IS TRUE AND p.hidden_at IS NULL AND p.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM content_reports cr
                      WHERE cr.target_id = p.id AND cr.status IN ('pending','reviewing'))
  ) s
  WHERE s.like_count >= 3 AND s.item_count >= 3
  ORDER BY (s.like_count::numeric / (1 + (extract(epoch FROM now() - s.updated_at) / 86400) / 45)) DESC,
           s.updated_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 8), 24));
$$;

-- ---------------------------------------------------------------------------
-- 2) Trending titles.
-- Ranking: unique members who added the title to any personal list within the
-- window (default 30 days). Duplicate-event proof via count(distinct user_id).
-- Eligibility: >= 3 unique recent members, and a displayable media_records row.
-- Recency tiebreak by most recent add. No private list content is exposed —
-- only the aggregate count and public catalogue metadata.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_community_trending_titles(p_days integer DEFAULT 30, p_limit integer DEFAULT 12)
RETURNS TABLE (
  media_key text,
  title text,
  poster_url text,
  media_type text,
  source text,
  external_id text,
  genres text[],
  member_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mr.media_key, mr.title, mr.poster_url, mr.media_type, mr.source, mr.external_id,
         mr.genres, agg.member_count
  FROM (
    SELECT li.media_key,
           count(DISTINCT li.user_id) AS member_count,
           max(li.created_at) AS last_add
    FROM list_items li
    WHERE li.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 120)))
    GROUP BY li.media_key
    HAVING count(DISTINCT li.user_id) >= 3
  ) agg
  JOIN media_records mr ON mr.media_key = agg.media_key
  ORDER BY agg.member_count DESC, agg.last_add DESC
  LIMIT greatest(1, least(coalesce(p_limit, 12), 30));
$$;

-- ---------------------------------------------------------------------------
-- 3) Helpful reviews.
-- Ranking: helpful votes = distinct likers excluding the review's own author
-- (self-vote excluded), with recency decay (half-life ~30 days). Eligibility:
-- not hidden, not deleted, body length >= 80 chars (minimum text quality),
-- >= 2 helpful votes, and no unresolved report. Author name shown only when the
-- author's profile is public AND they allow showing reviews.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_community_helpful_reviews(p_limit integer DEFAULT 6)
RETURNS TABLE (
  id uuid,
  body text,
  rating smallint,
  media_source text,
  media_external_id text,
  media_title text,
  media_poster_url text,
  author_display_name text,
  helpful_votes bigint,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.body, s.rating, s.media_source, s.media_external_id,
         s.media_title, s.media_poster_url, s.author_display_name, s.helpful_votes, s.created_at
  FROM (
    SELECT
      r.id, r.body, r.rating, r.media_source, r.media_external_id,
      mr.title AS media_title, mr.poster_url AS media_poster_url,
      CASE WHEN pr.profile_public IS TRUE AND pr.show_reviews IS TRUE AND pr.display_name IS NOT NULL
           THEN pr.display_name ELSE 'Membre KAZEN' END AS author_display_name,
      (SELECT count(DISTINCT rl.user_id) FROM review_likes rl
        WHERE rl.review_id = r.id AND rl.user_id <> r.user_id) AS helpful_votes,
      r.created_at
    FROM fiche_reviews r
    LEFT JOIN profiles pr ON pr.id = r.user_id
    LEFT JOIN media_records mr ON mr.media_key = r.media_source || ':' || r.media_external_id
    WHERE r.hidden_at IS NULL AND r.deleted_at IS NULL
      AND char_length(coalesce(r.body, '')) >= 80
      AND NOT EXISTS (SELECT 1 FROM content_reports cr
                      WHERE cr.target_id = r.id AND cr.status IN ('pending','reviewing'))
  ) s
  WHERE s.helpful_votes >= 2
  ORDER BY (s.helpful_votes::numeric / (1 + (extract(epoch FROM now() - s.created_at) / 86400) / 30)) DESC,
           s.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 6), 20));
$$;

-- ---------------------------------------------------------------------------
-- 4) Genre trends.
-- Aggregate distinct members per genre from adds within the window. Threshold
-- >= 3 unique members per genre. No individual activity exposed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_community_genre_trends(p_days integer DEFAULT 30, p_limit integer DEFAULT 8)
RETURNS TABLE (genre text, member_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.genre, count(DISTINCT li.user_id) AS member_count
  FROM list_items li
  JOIN media_records mr ON mr.media_key = li.media_key
  CROSS JOIN LATERAL unnest(coalesce(mr.genres, ARRAY[]::text[])) AS g(genre)
  WHERE li.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 120)))
    AND g.genre IS NOT NULL AND length(trim(g.genre)) > 0
  GROUP BY g.genre
  HAVING count(DISTINCT li.user_id) >= 3
  ORDER BY member_count DESC, g.genre ASC
  LIMIT greatest(1, least(coalesce(p_limit, 8), 20));
$$;

-- ---------------------------------------------------------------------------
-- 5) Community contributors (public badges only).
-- Only visible public badge assignments on active badges, for members whose
-- profile is public. Purely public awards — never derived from private data.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_community_contributors(p_limit integer DEFAULT 12)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  badge_label text,
  visual_variant text,
  icon_key text,
  assigned_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ub.user_id,
         coalesce(pr.display_name, 'Membre KAZEN') AS display_name,
         pr.avatar_url,
         b.label AS badge_label,
         b.visual_variant,
         b.icon_key,
         ub.assigned_at
  FROM user_public_badges ub
  JOIN public_badges b ON b.id = ub.badge_id AND b.is_active IS TRUE
  JOIN profiles pr ON pr.id = ub.user_id AND pr.profile_public IS TRUE
  WHERE ub.is_visible IS TRUE
  ORDER BY ub.assigned_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 12), 24));
$$;

-- Aggregate, privacy-safe read endpoints: callable by anyone (incl. anonymous).
GRANT EXECUTE ON FUNCTION public.get_community_popular_playlists(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_trending_titles(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_helpful_reviews(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_genre_trends(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_contributors(integer) TO anon, authenticated;
