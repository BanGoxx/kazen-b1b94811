import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

// Communauté KAZEN — Forum.
// Lectures publiques via le client navigateur (RLS autorise anon sur le contenu
// visible). Toutes les écritures passent par des RPC SECURITY DEFINER qui
// vérifient l'identité, la propriété, les rôles, les limites anti-spam et
// déclenchent les notifications pertinentes. Aucune écriture directe en table.

export const TOPICS_PER_PAGE = 20;
export const POSTS_PER_PAGE = 20;

export interface ForumCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
  isLocked: boolean;
}

export interface AuthorLite {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ForumTopic {
  id: string;
  categoryId: string;
  author: AuthorLite;
  title: string;
  body: string;
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  hidden: boolean;
  deleted: boolean;
  coverPath: string | null;
  coverAlt: string | null;
  coverSource: string | null;
}

export interface ForumPost {
  id: string;
  topicId: string;
  author: AuthorLite;
  body: string;
  replyToId: string | null;
  createdAt: string;
  updatedAt: string;
  hidden: boolean;
  deleted: boolean;
}

function mapCategory(row: Record<string, unknown>): ForumCategory {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    icon: (row.icon as string) ?? "MessageSquare",
    sortOrder: (row.sort_order as number) ?? 100,
    isLocked: Boolean(row.is_locked),
  };
}

const UNKNOWN_AUTHOR: AuthorLite = {
  id: "",
  displayName: "Membre KAZEN",
  avatarUrl: null,
};

async function fetchAuthors(ids: string[]): Promise<Map<string, AuthorLite>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, AuthorLite>();
  if (unique.length === 0) return map;
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", unique);
  for (const p of data ?? []) {
    map.set(p.id, {
      id: p.id,
      displayName: p.display_name ?? "Membre KAZEN",
      avatarUrl: p.avatar_url ?? null,
    });
  }
  return map;
}

function mapTopic(row: Record<string, unknown>, authors: Map<string, AuthorLite>): ForumTopic {
  const authorId = row.author_id as string;
  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    author: authors.get(authorId) ?? { ...UNKNOWN_AUTHOR, id: authorId },
    title: row.title as string,
    body: (row.body as string) ?? "",
    isPinned: Boolean(row.is_pinned),
    isLocked: Boolean(row.is_locked),
    replyCount: (row.reply_count as number) ?? 0,
    lastActivityAt: row.last_activity_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    hidden: Boolean(row.hidden_at),
    deleted: Boolean(row.deleted_at),
  };
}

function mapPost(row: Record<string, unknown>, authors: Map<string, AuthorLite>): ForumPost {
  const authorId = row.author_id as string;
  return {
    id: row.id as string,
    topicId: row.topic_id as string,
    author: authors.get(authorId) ?? { ...UNKNOWN_AUTHOR, id: authorId },
    body: (row.body as string) ?? "",
    replyToId: (row.reply_to_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    hidden: Boolean(row.hidden_at),
    deleted: Boolean(row.deleted_at),
  };
}

// --- Categories -------------------------------------------------------------

export function useForumCategories() {
  return useQuery({
    queryKey: ["forum-categories"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ForumCategory[]> => {
      const { data, error } = await supabase
        .from("forum_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapCategory);
    },
  });
}

export interface CategoryOverview extends ForumCategory {
  topicCount: number;
  latest: { id: string; title: string; lastActivityAt: string } | null;
}

// Community index: categories + per-category counts + latest topic.
export function useForumOverview() {
  return useQuery({
    queryKey: ["forum-overview"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<CategoryOverview[]> => {
      const { data: cats, error } = await supabase
        .from("forum_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      const categories = (cats ?? []).map(mapCategory);

      const overviews = await Promise.all(
        categories.map(async (c) => {
          const [{ count }, { data: latest }] = await Promise.all([
            supabase
              .from("forum_topics")
              .select("id", { count: "exact", head: true })
              .eq("category_id", c.id)
              .is("hidden_at", null)
              .is("deleted_at", null),
            supabase
              .from("forum_topics")
              .select("id, title, last_activity_at")
              .eq("category_id", c.id)
              .is("hidden_at", null)
              .is("deleted_at", null)
              .order("last_activity_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);
          return {
            ...c,
            topicCount: count ?? 0,
            latest: latest
              ? {
                  id: latest.id as string,
                  title: latest.title as string,
                  lastActivityAt: latest.last_activity_at as string,
                }
              : null,
          };
        }),
      );
      return overviews;
    },
  });
}

// Latest topics across all categories (community index rail).
export function useRecentTopics(limit = 8) {
  return useQuery({
    queryKey: ["forum-recent-topics", limit],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<ForumTopic[]> => {
      const { data, error } = await supabase
        .from("forum_topics")
        .select("*")
        .is("hidden_at", null)
        .is("deleted_at", null)
        .order("is_pinned", { ascending: false })
        .order("last_activity_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const authors = await fetchAuthors(rows.map((r) => r.author_id as string));
      return rows.map((r) => mapTopic(r, authors));
    },
  });
}

// --- Category topics (paginated) --------------------------------------------

export interface TopicsPage {
  category: ForumCategory | null;
  topics: ForumTopic[];
  total: number;
  page: number;
  pageCount: number;
}

export function useCategoryTopics(slug: string, page: number) {
  return useQuery({
    queryKey: ["forum-category-topics", slug, page],
    staleTime: 30 * 1000,
    queryFn: async (): Promise<TopicsPage> => {
      const { data: cat } = await supabase
        .from("forum_categories")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      const category = cat ? mapCategory(cat) : null;
      if (!category) {
        return { category: null, topics: [], total: 0, page, pageCount: 0 };
      }
      const from = page * TOPICS_PER_PAGE;
      const to = from + TOPICS_PER_PAGE - 1;
      const { data, error, count } = await supabase
        .from("forum_topics")
        .select("*", { count: "exact" })
        .eq("category_id", category.id)
        .is("hidden_at", null)
        .is("deleted_at", null)
        .order("is_pinned", { ascending: false })
        .order("last_activity_at", { ascending: false })
        .range(from, to);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const authors = await fetchAuthors(rows.map((r) => r.author_id as string));
      const total = count ?? 0;
      return {
        category,
        topics: rows.map((r) => mapTopic(r, authors)),
        total,
        page,
        pageCount: Math.max(1, Math.ceil(total / TOPICS_PER_PAGE)),
      };
    },
  });
}

// --- Topic + posts ----------------------------------------------------------

export function useTopic(id: string) {
  return useQuery({
    queryKey: ["forum-topic", id],
    staleTime: 15 * 1000,
    queryFn: async (): Promise<ForumTopic | null> => {
      const { data, error } = await supabase
        .from("forum_topics")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const authors = await fetchAuthors([data.author_id as string]);
      return mapTopic(data, authors);
    },
  });
}

export interface PostsPage {
  posts: ForumPost[];
  total: number;
  page: number;
  pageCount: number;
}

export function useTopicPosts(topicId: string, page: number) {
  return useQuery({
    queryKey: ["forum-topic-posts", topicId, page],
    staleTime: 15 * 1000,
    queryFn: async (): Promise<PostsPage> => {
      const from = page * POSTS_PER_PAGE;
      const to = from + POSTS_PER_PAGE - 1;
      const { data, error, count } = await supabase
        .from("forum_posts")
        .select("*", { count: "exact" })
        .eq("topic_id", topicId)
        .is("hidden_at", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .range(from, to);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const authors = await fetchAuthors(rows.map((r) => r.author_id as string));
      const total = count ?? 0;
      return {
        posts: rows.map((r) => mapPost(r, authors)),
        total,
        page,
        pageCount: Math.max(1, Math.ceil(total / POSTS_PER_PAGE)),
      };
    },
  });
}

// --- Mutations --------------------------------------------------------------

export function useCreateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { categoryId: string; title: string; body: string }) => {
      const { data, error } = await supabase.rpc("create_forum_topic", {
        _category: input.categoryId,
        _title: input.title,
        _body: input.body,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum-overview"] });
      qc.invalidateQueries({ queryKey: ["forum-recent-topics"] });
      qc.invalidateQueries({ queryKey: ["forum-category-topics"] });
    },
  });
}

export function useCreatePost(topicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { body: string; replyToId?: string | null }) => {
      const { data, error } = await supabase.rpc("create_forum_post", {
        _topic: topicId,
        _body: input.body,
        _reply_to: input.replyToId ?? undefined,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum-topic-posts", topicId] });
      qc.invalidateQueries({ queryKey: ["forum-topic", topicId] });
    },
  });
}

export function useEditTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; title: string; body: string }) => {
      const { error } = await supabase.rpc("edit_forum_topic", {
        _id: input.id,
        _title: input.title,
        _body: input.body,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["forum-topic", v.id] });
      qc.invalidateQueries({ queryKey: ["forum-category-topics"] });
    },
  });
}

export function useEditPost(topicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body: string }) => {
      const { error } = await supabase.rpc("edit_forum_post", {
        _id: input.id,
        _body: input.body,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum-topic-posts", topicId] });
    },
  });
}

export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_forum_topic", { _id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum-overview"] });
      qc.invalidateQueries({ queryKey: ["forum-recent-topics"] });
      qc.invalidateQueries({ queryKey: ["forum-category-topics"] });
    },
  });
}

export function useDeletePost(topicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_forum_post", { _id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum-topic-posts", topicId] });
      qc.invalidateQueries({ queryKey: ["forum-topic", topicId] });
    },
  });
}

export function useReportForum() {
  return useMutation({
    mutationFn: async (input: {
      targetType: "topic" | "post";
      targetId: string;
      reason: string;
      details?: string;
    }) => {
      const { data, error } = await supabase.rpc("submit_forum_report", {
        _target_type: input.targetType,
        _target_id: input.targetId,
        _reason: input.reason,
        _details: input.details ?? "",
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
  });
}

export function useModerateForum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      targetType: "topic" | "post";
      targetId: string;
      action: "hide" | "unhide" | "soft_delete" | "restore";
      note?: string;
    }) => {
      const { error } = await supabase.rpc("moderate_forum", {
        _target_type: input.targetType,
        _target_id: input.targetId,
        _action: input.action,
        _note: input.note ?? "",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum-topic"] });
      qc.invalidateQueries({ queryKey: ["forum-topic-posts"] });
      qc.invalidateQueries({ queryKey: ["forum-category-topics"] });
      qc.invalidateQueries({ queryKey: ["forum-reports"] });
    },
  });
}

// --- Moderation queue (mods only) -------------------------------------------

export interface ForumReportRow {
  id: string;
  targetType: "topic" | "post";
  targetId: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  preview: string;
  link: string | null;
}

export function useForumReports(enabled: boolean, status = "open") {
  return useQuery({
    queryKey: ["forum-reports", status],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<ForumReportRow[]> => {
      let q = supabase
        .from("forum_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (status === "open") q = q.in("status", ["pending", "reviewing"]);
      else if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = data ?? [];

      const reporters = await fetchAuthors(rows.map((r) => r.reporter_id as string));
      const enriched = await Promise.all(
        rows.map(async (r) => {
          let preview = "(contenu introuvable)";
          let link: string | null = null;
          if (r.target_type === "topic") {
            const { data: t } = await supabase
              .from("forum_topics")
              .select("title, body")
              .eq("id", r.target_id)
              .maybeSingle();
            if (t) {
              preview = [t.title, (t.body as string)?.slice(0, 160)].filter(Boolean).join(" — ");
              link = `/communaute/t/${r.target_id}`;
            }
          } else {
            const { data: p } = await supabase
              .from("forum_posts")
              .select("body, topic_id")
              .eq("id", r.target_id)
              .maybeSingle();
            if (p) {
              preview = (p.body as string)?.slice(0, 200) ?? "";
              link = `/communaute/t/${p.topic_id}`;
            }
          }
          return {
            id: r.id as string,
            targetType: r.target_type as "topic" | "post",
            targetId: r.target_id as string,
            reporterId: r.reporter_id as string,
            reporterName: reporters.get(r.reporter_id as string)?.displayName ?? "Membre KAZEN",
            reason: r.reason as string,
            details: (r.details as string) ?? "",
            status: r.status as string,
            createdAt: r.created_at as string,
            preview,
            link,
          };
        }),
      );
      return enriched;
    },
  });
}

export function useResolveForumReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: string; note?: string }) => {
      const { error } = await supabase.rpc("resolve_forum_report", {
        _id: input.id,
        _status: input.status,
        _note: input.note ?? "",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forum-reports"] }),
  });
}

// Whether the current signed-in user may perform author actions on a resource.
export function useIsAuthor(authorId: string | undefined): boolean {
  const { user } = useAuth();
  return Boolean(user && authorId && user.id === authorId);
}
