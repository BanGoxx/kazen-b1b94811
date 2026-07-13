import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Phase 11 — Community thread cover images.
//
// Storage: dedicated PRIVATE bucket `forum-covers`. Public buckets are blocked
// by the workspace policy, so covers are served through short-lived signed URLs
// generated in ONE batched call per list (no per-image N+1, no regeneration
// loop — the resolved URLs are cached by React Query). A public-read RLS policy
// on storage.objects lets anonymous visitors mint those signed URLs, so covers
// display for signed-out members too, while writes stay owner-scoped.
//
// Ownership & safety:
//  - Uploads only into `${uid}/…` (RLS enforces the folder = auth.uid()).
//  - Object names are randomised (crypto.randomUUID) and non-guessable.
//  - Only jpeg/png/webp are accepted (client validation + RLS extension check).
//  - The topic.cover_image_path is set through the SECURITY DEFINER RPC
//    `set_forum_topic_cover`, which re-checks authorship and the path shape.

export const COVER_BUCKET = "forum-covers";
export const MAX_COVER_BYTES = 5 * 1024 * 1024; // 5 MB before processing
export const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_COVER_LABEL = "JPEG, PNG ou WebP · 5 Mo max";
const SIGNED_URL_TTL = 60 * 60; // 1 h

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface CoverValidation {
  ok: boolean;
  error?: string;
}

/**
 * Validate a candidate cover file: MIME allow-list, size cap, and a real
 * decode check to reject malformed / spoofed files before any upload.
 */
export async function validateCoverFile(file: File): Promise<CoverValidation> {
  if (!ALLOWED_COVER_TYPES.includes(file.type as (typeof ALLOWED_COVER_TYPES)[number])) {
    return { ok: false, error: "Format non supporté. Utilisez une image JPEG, PNG ou WebP." };
  }
  if (file.size > MAX_COVER_BYTES) {
    return { ok: false, error: "Image trop lourde (5 Mo maximum)." };
  }
  if (file.size === 0) {
    return { ok: false, error: "Fichier vide ou illisible." };
  }
  // Decode check — malformed images throw here.
  try {
    if (typeof createImageBitmap === "function") {
      const bmp = await createImageBitmap(file);
      const bad = bmp.width === 0 || bmp.height === 0;
      bmp.close?.();
      if (bad) return { ok: false, error: "Image illisible." };
    }
  } catch {
    return { ok: false, error: "Image illisible ou corrompue." };
  }
  return { ok: true };
}

/** Upload a validated cover for a topic into the owner's folder. Returns the object path. */
export async function uploadCover(file: File, topicId: string, userId: string): Promise<string> {
  const ext = EXT_BY_TYPE[file.type] ?? "jpg";
  const path = `${userId}/${topicId}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(COVER_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
  if (error) throw new Error(error.message);
  return path;
}

/** Best-effort deletion of a storage object (used to compensate on failures / replace / remove). */
export async function deleteCoverFile(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    await supabase.storage.from(COVER_BUCKET).remove([path]);
  } catch {
    /* orphan cleanup is best-effort; never block the UX */
  }
}

/** Author-only: persist / replace / remove the cover path on the topic. Pass null to clear. */
export async function setTopicCover(
  topicId: string,
  path: string | null,
  alt: string | null,
  source: "upload" | "ai" = "upload",
): Promise<void> {
  const { error } = await supabase.rpc("set_forum_topic_cover", {
    _topic: topicId,
    // _path is intentionally nullable at runtime (null clears the cover); the
    // generated type marks it required, so we cast to satisfy the signature.
    _path: path as unknown as string,
    _alt: alt ?? undefined,
    _source: source,
  });
  if (error) throw new Error(error.message);
}

/** Moderator/Owner-only: clear an inappropriate cover. Returns the old path (for storage cleanup). */
export async function moderateClearCover(topicId: string, note = ""): Promise<string | null> {
  const { data, error } = await supabase.rpc("moderate_clear_forum_cover", {
    _topic: topicId,
    _note: note,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

/** Batch-resolve signed URLs for a set of cover paths in a single request. */
export async function resolveCoverUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase.storage.from(COVER_BUCKET).createSignedUrls(unique, SIGNED_URL_TTL);
  for (const row of data ?? []) {
    if (row.signedUrl && row.path) map.set(row.path, row.signedUrl);
  }
  return map;
}

/**
 * Resolve signed URLs for a list of cover paths (one batched request, cached).
 * Returns a Map keyed by storage path. Missing objects simply resolve to
 * undefined and callers fall back to the SafeImage placeholder.
 */
export function useCoverUrls(paths: (string | null | undefined)[]) {
  const clean = Array.from(new Set(paths.filter((p): p is string => Boolean(p)))).sort();
  return useQuery({
    queryKey: ["forum-cover-urls", clean],
    enabled: clean.length > 0,
    staleTime: 30 * 60 * 1000, // < signed TTL, so URLs never expire mid-cache
    queryFn: () => resolveCoverUrls(clean),
  });
}
