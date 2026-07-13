import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

// Phase 11.1 — Server-authorized signing boundary for forum cover images.
//
// The `forum-covers` bucket is private and no longer carries any public
// read/list policy. Signed URLs are minted here, server-side, with the service
// role — but ONLY after we confirm the caller may view each requested topic:
//  - anonymous / any user  → visible public topics (not hidden, not deleted);
//  - authenticated author  → their own topics (even hidden/deleted);
//  - moderator / owner     → all topics (per existing moderation access).
//
// The client sends bounded, validated topic IDs — never storage paths. Trusted
// `cover_image_path` values are read server-side, so a client can neither
// enumerate the bucket nor sign an arbitrary path.

const MAX_TOPIC_IDS = 60;
const SIGNED_URL_TTL = 60 * 60; // 1 h — matches the previous safe value.
const COVER_BUCKET = "forum-covers";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SignTopicCoversInput {
  topicIds: string[];
}

/** Returns a map { topicId → signedUrl } for authorized topics only. */
export const signTopicCovers = createServerFn({ method: "POST" })
  .inputValidator((input: SignTopicCoversInput) => {
    const raw = Array.isArray(input?.topicIds) ? input.topicIds : [];
    const clean = Array.from(
      new Set(raw.filter((v): v is string => typeof v === "string" && UUID_RE.test(v))),
    ).slice(0, MAX_TOPIC_IDS);
    return { topicIds: clean };
  })
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const result: Record<string, string> = {};
    if (data.topicIds.length === 0) return result;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Identify the caller (optional — anonymous visitors are allowed public covers).
    let userId: string | null = null;
    let isModerator = false;
    const authHeader = getRequestHeader("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length);
      if (token.split(".").length === 3) {
        try {
          const { data: userData } = await supabaseAdmin.auth.getUser(token);
          userId = userData?.user?.id ?? null;
          if (userId) {
            const { data: mod } = await supabaseAdmin.rpc("can_moderate_now", {
              _user_id: userId,
            });
            isModerator = Boolean(mod);
          }
        } catch {
          userId = null;
        }
      }
    }

    const { data: topics } = await supabaseAdmin
      .from("forum_topics")
      .select("id, cover_image_path, hidden_at, deleted_at, author_id")
      .in("id", data.topicIds);

    const toSign: { id: string; path: string }[] = [];
    for (const t of topics ?? []) {
      const path = (t.cover_image_path as string | null) ?? null;
      if (!path) continue;
      const visible = !t.hidden_at && !t.deleted_at;
      const isAuthor = Boolean(userId) && t.author_id === userId;
      if (visible || isAuthor || isModerator) {
        toSign.push({ id: t.id as string, path });
      }
    }
    if (toSign.length === 0) return result;

    const { data: signed } = await supabaseAdmin.storage
      .from(COVER_BUCKET)
      .createSignedUrls(
        toSign.map((x) => x.path),
        SIGNED_URL_TTL,
      );

    const byPath = new Map<string, string>();
    for (const row of signed ?? []) {
      if (row.signedUrl && row.path) byPath.set(row.path, row.signedUrl);
    }
    for (const x of toSign) {
      const url = byPath.get(x.path);
      if (url) result[x.id] = url;
    }
    return result;
  });
