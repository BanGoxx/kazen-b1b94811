import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// KAZEN — Personal data export (authenticated, own data only).
//
// SAFETY MODEL:
//  - Auth-guarded via requireSupabaseAuth; every query is scoped to
//    context.userId and RLS additionally enforces per-user isolation.
//  - Only the caller's own list_items + the shared public media metadata are
//    returned. No other users' data, no Founder/private enrichment notes, no
//    auth/session data.

export interface ExportEntry {
  title: string;
  original_title: string | null;
  type: string;
  year: number | null;
  source: string;
  external_id: string;
  anilist_id: string | null;
  tmdb_id: string | null;
  status: string | null;
  rating: number | null;
  notes: string;
  tags: string[];
  progress: number | null;
  started_at: string | null;
  completed_at: string | null;
  rewatch_count: number;
  is_rewatching: boolean;
  created_at: string;
  updated_at: string;
  import_provider: string | null;
  import_ref: string | null;
}

export interface ExportPayload {
  export_version: number;
  exported_at: string;
  app: "KAZEN";
  count: number;
  entries: ExportEntry[];
}

function yearFromReleaseDate(release: string | null): number | null {
  if (!release) return null;
  const y = parseInt(release.slice(0, 4), 10);
  return Number.isNaN(y) ? null : y;
}

export const exportMyData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExportPayload> => {
    const { data, error } = await context.supabase
      .from("list_items")
      .select(
        "status,rating,notes,tags,progress,started_at,completed_at,rewatch_count,is_rewatching,created_at,updated_at,import_provider,import_ref,media_records(source,external_id,media_type,title,title_original,release_date)",
      )
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const entries: ExportEntry[] = (data ?? []).map((row) => {
      const rec = row.media_records as {
        source: string;
        external_id: string;
        media_type: string;
        title: string;
        title_original: string | null;
        release_date: string | null;
      } | null;
      const source = rec?.source ?? "";
      const externalId = rec?.external_id ?? "";
      const anilistId = source === "anilist" ? externalId || null : null;
      const tmdbId = source.startsWith("tmdb") ? externalId || null : null;
      return {
        title: rec?.title ?? "",
        original_title: rec?.title_original ?? null,
        type: rec?.media_type ?? "",
        year: yearFromReleaseDate(rec?.release_date ?? null),
        source,
        external_id: externalId,
        anilist_id: anilistId,
        tmdb_id: tmdbId,
        status: row.status ?? null,
        rating: row.rating ?? null,
        notes: row.notes ?? "",
        tags: row.tags ?? [],
        progress: row.progress ?? null,
        started_at: row.started_at ?? null,
        completed_at: row.completed_at ?? null,
        rewatch_count: row.rewatch_count ?? 0,
        is_rewatching: row.is_rewatching ?? false,
        created_at: row.created_at,
        updated_at: row.updated_at,
        import_provider: row.import_provider ?? null,
        import_ref: row.import_ref ?? null,
      };
    });

    return {
      export_version: 1,
      exported_at: new Date().toISOString(),
      app: "KAZEN",
      count: entries.length,
      entries,
    };
  });
