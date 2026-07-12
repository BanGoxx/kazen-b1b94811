import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// KAZEN Data Enrichment Layer — Phase 1 Owner CRUD.
//
// Every operation re-verifies the caller is the unique Owner via the
// SECURITY DEFINER `can_moderate_now`. RLS on `media_enrichments` enforces the
// same rule independently; these functions expose the private (unpublished /
// notes) fields the Owner console needs to read and edit.

async function assertOwner(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}): Promise<void> {
  const { data, error } = await context.supabase.rpc("can_moderate_now", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const SELECT_COLUMNS =
  "id, source, external_id, title_override, native_title_override, synopsis_override, poster_url_override, backdrop_url_override, status_note, data_quality_status, enrichment_notes, is_published, updated_at";

// --- Owner reads a single enrichment (private fields included) ----------------
export const getEnrichment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { source: string; externalId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { data: row, error } = await context.supabase
      .from("media_enrichments")
      .select(SELECT_COLUMNS)
      .eq("source", data.source)
      .eq("external_id", data.externalId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });

// --- Owner lists recent enrichments (search by title/id) ----------------------
export const listEnrichments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { search?: string }) => data)
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    let q = context.supabase
      .from("media_enrichments")
      .select(SELECT_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(50);
    const search = (data.search ?? "").trim();
    if (search) {
      q = q.or(
        `external_id.ilike.%${search}%,title_override.ilike.%${search}%,native_title_override.ilike.%${search}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

interface EnrichmentInput {
  source: string;
  externalId: string;
  titleOverride?: string | null;
  nativeTitleOverride?: string | null;
  synopsisOverride?: string | null;
  posterUrlOverride?: string | null;
  backdropUrlOverride?: string | null;
  statusNote?: string | null;
  dataQualityStatus?: string | null;
  enrichmentNotes?: string | null;
  isPublished?: boolean;
}

const norm = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};

// --- Owner creates or updates an enrichment record ----------------------------
export const upsertEnrichment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: EnrichmentInput) => data)
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const source = data.source.trim();
    const externalId = data.externalId.trim();
    if (!source || !externalId)
      throw new Error("Source et identifiant requis.");
    const allowedStatus = [
      "complete",
      "partial",
      "provider_limited",
      "needs_review",
    ];
    const status = allowedStatus.includes(data.dataQualityStatus ?? "")
      ? data.dataQualityStatus
      : "needs_review";

    const { error } = await context.supabase.from("media_enrichments").upsert(
      {
        source,
        external_id: externalId,
        title_override: norm(data.titleOverride),
        native_title_override: norm(data.nativeTitleOverride),
        synopsis_override: norm(data.synopsisOverride),
        poster_url_override: norm(data.posterUrlOverride),
        backdrop_url_override: norm(data.backdropUrlOverride),
        status_note: norm(data.statusNote),
        data_quality_status: status,
        enrichment_notes: norm(data.enrichmentNotes),
        is_published: data.isPublished ?? false,
        updated_by: context.userId,
        created_by: context.userId,
      },
      { onConflict: "source,external_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Owner deletes an enrichment record ---------------------------------------
export const deleteEnrichment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { source: string; externalId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { error } = await context.supabase
      .from("media_enrichments")
      .delete()
      .eq("source", data.source)
      .eq("external_id", data.externalId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
