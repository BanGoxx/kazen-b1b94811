// KAZEN — Import backbone server functions (parse → preview → confirm → rollback).
//
// SAFETY MODEL:
//  - Every function is auth-guarded (requireSupabaseAuth) and scoped to the
//    caller via context.userId; RLS additionally enforces per-user isolation.
//  - Parsing happens client-side from user-provided files. The server receives
//    only neutral ImportEntry[] and never fetches/crawls third-party sites.
//  - The preview NEVER writes to list_items. Only confirmImport writes, and it
//    records enough state (applied_action + previous_item) to roll back later.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ImportEntry } from "./import/import-schema";
import { toKazenRating, toKazenStatus } from "./import/import-schema";
import { titleSimilarity } from "./import/match";

const EXACT = 0.9;
const PROBABLE = 0.7;
const MAX_ITEMS = 500;

type MatchStatus = "exact" | "probable" | "needs_confirmation" | "unmatched" | "duplicate";
type ImportAction = "create" | "update" | "skip" | "needs_user_choice";

// ---------- create batch ----------
export const createImportBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { provider: string; sourceMetadata?: Record<string, unknown>; entries: ImportEntry[] }) =>
      data,
  )
  .handler(async ({ data, context }) => {
    const entries = (data.entries ?? []).slice(0, MAX_ITEMS);
    if (entries.length === 0) throw new Error("Aucune entrée à importer.");

    const { data: batch, error: bErr } = await context.supabase
      .from("import_batches")
      .insert({
        user_id: context.userId,
        provider: data.provider,
        status: "parsed",
        source_metadata: {
          ...(data.sourceMetadata ?? {}),
          entry_count: entries.length,
        },
      })
      .select("id")
      .single();
    if (bErr) throw new Error(bErr.message);

    const rows = entries.map((e) => ({
      batch_id: batch.id,
      user_id: context.userId,
      provider: data.provider,
      provider_ref: e.providerUrl ?? e.providerId,
      raw_title: e.title,
      normalized_title: e.title,
      alt_titles: e.altTitles ?? [],
      media_type: e.mediaType,
      release_year: e.releaseYear,
      total_episodes: e.totalEpisodes,
      user_status: e.status,
      user_score: e.score,
      progress: e.progress,
      started_at: e.startedAt,
      completed_at: e.completedAt,
      notes: e.comments ?? null,
      user_tags: e.userTags ?? [],
      rewatch_count: e.rewatchCount ?? null,
      is_rewatching: e.isRewatching ?? false,
    }));
    const { error: iErr } = await context.supabase.from("import_items").insert(rows);
    if (iErr) throw new Error(iErr.message);

    return { batchId: batch.id, count: entries.length };
  });

// ---------- list batches ----------
export const getImportBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("import_batches")
      .select("id,provider,status,source_metadata,created_at,completed_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- preview (runs matching, NO writes to list_items) ----------
export const getImportPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { batchId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: batch, error: bErr } = await context.supabase
      .from("import_batches")
      .select("id,provider,status")
      .eq("id", data.batchId)
      .single();
    if (bErr) throw new Error(bErr.message);

    const { data: items, error: iErr } = await context.supabase
      .from("import_items")
      .select("*")
      .eq("batch_id", data.batchId)
      .order("created_at", { ascending: true });
    if (iErr) throw new Error(iErr.message);

    // Existing user list keys for duplicate detection.
    const { data: listRows } = await context.supabase.from("list_items").select("media_key");
    const existingKeys = new Set((listRows ?? []).map((r) => r.media_key));

    const results = [];
    for (const it of items ?? []) {
      // Candidate lookup against the shared KAZEN catalog (media_records).
      const firstWord = (it.normalized_title ?? it.raw_title).split(/\s+/)[0] ?? "";
      const { data: cands } = await context.supabase
        .from("media_records")
        .select("media_key,title,title_original,media_type,release_date")
        .ilike("title", `%${firstWord}%`)
        .limit(12);

      let bestKey: string | null = null;
      let bestConf = 0;
      const itemTitles = [it.raw_title, ...(it.alt_titles ?? [])].filter(Boolean) as string[];
      for (const c of cands ?? []) {
        const candTitles = [c.title, c.title_original].filter(Boolean) as string[];
        let sim = 0;
        for (const a of itemTitles) for (const b of candTitles) sim = Math.max(sim, titleSimilarity(a, b));
        let conf = sim * 0.8;
        if (it.release_year && c.release_date) {
          const cy = parseInt(c.release_date.slice(0, 4), 10);
          if (!Number.isNaN(cy)) conf += Math.abs(cy - it.release_year) === 0 ? 0.15 : Math.abs(cy - it.release_year) === 1 ? 0.05 : -0.1;
        }
        conf = Math.max(0, Math.min(1, conf));
        if (conf > bestConf) {
          bestConf = conf;
          bestKey = c.media_key;
        }
      }

      let matchStatus: MatchStatus = "unmatched";
      let action: ImportAction = "skip";
      if (bestKey) {
        if (existingKeys.has(bestKey) && bestConf >= PROBABLE) {
          matchStatus = "duplicate";
          action = "skip";
        } else if (bestConf >= EXACT) {
          matchStatus = "exact";
          action = "create";
        } else if (bestConf >= PROBABLE) {
          matchStatus = "probable";
          action = "needs_user_choice";
        } else {
          matchStatus = "needs_confirmation";
          action = "needs_user_choice";
          bestKey = bestConf >= 0.4 ? bestKey : null;
        }
      }

      await context.supabase
        .from("import_items")
        .update({
          matched_media_key: bestKey,
          match_confidence: Number(bestConf.toFixed(3)),
          match_status: matchStatus,
          import_action: action,
        })
        .eq("id", it.id);

      results.push({ ...it, matched_media_key: bestKey, match_confidence: bestConf, match_status: matchStatus, import_action: action });
    }

    const summary = {
      total: results.length,
      exact: results.filter((r) => r.match_status === "exact").length,
      probable: results.filter((r) => r.match_status === "probable").length,
      needs_confirmation: results.filter((r) => r.match_status === "needs_confirmation").length,
      unmatched: results.filter((r) => r.match_status === "unmatched").length,
      duplicate: results.filter((r) => r.match_status === "duplicate").length,
    };

    await context.supabase
      .from("import_batches")
      .update({ status: "needs_review" })
      .eq("id", data.batchId);

    return { batch, items: results, summary };
  });

// ---------- confirm (writes only confirmed items, records rollback state) ----------
export const confirmImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { batchId: string; confirmItemIds?: string[] }) => d)
  .handler(async ({ data, context }) => {
    const { data: items, error } = await context.supabase
      .from("import_items")
      .select("*")
      .eq("batch_id", data.batchId);
    if (error) throw new Error(error.message);

    const confirmSet = data.confirmItemIds ? new Set(data.confirmItemIds) : null;
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const it of items ?? []) {
      const wantsWrite =
        it.matched_media_key &&
        (it.import_action === "create" ||
          it.import_action === "update" ||
          (it.import_action === "needs_user_choice" && confirmSet?.has(it.id)));

      // Only write items explicitly safe or explicitly confirmed by the user.
      const allowed = confirmSet ? confirmSet.has(it.id) : it.import_action === "create";
      if (!wantsWrite || !allowed || !it.matched_media_key) {
        await context.supabase
          .from("import_items")
          .update({ applied_action: "skipped", applied_at: new Date().toISOString() })
          .eq("id", it.id);
        skipped++;
        continue;
      }

      // Snapshot any existing row for rollback (including tracking fields).
      const { data: existing } = await context.supabase
        .from("list_items")
        .select(
          "media_key,status,favorite,priority,rating,notes,tags,progress,started_at,completed_at,rewatch_count,is_rewatching,import_provider,import_ref",
        )
        .eq("user_id", context.userId)
        .eq("media_key", it.matched_media_key)
        .maybeSingle();

      const patch: Record<string, unknown> = {};
      const st = toKazenStatus(it.user_status as never);
      const rating = toKazenRating(it.user_score);

      if (!existing) {
        // On CREATE, seed every available tracking field from the import.
        if (st) patch.status = st;
        if (rating != null) patch.rating = rating;
        if (it.notes) patch.notes = it.notes;
        if (Array.isArray(it.user_tags) && it.user_tags.length > 0) patch.tags = it.user_tags;
        if (it.progress != null) patch.progress = it.progress;
        if (it.started_at) patch.started_at = it.started_at;
        if (it.completed_at) patch.completed_at = it.completed_at;
        if (it.rewatch_count != null) patch.rewatch_count = it.rewatch_count;
        if (it.is_rewatching) patch.is_rewatching = it.is_rewatching;
        patch.import_provider = it.provider;
        if (it.provider_ref) patch.import_ref = it.provider_ref;
      } else {
        // On UPDATE (explicitly confirmed duplicate), never clobber the user's
        // own non-null data — only fill fields that are currently empty.
        if (st && !existing.status) patch.status = st;
        if (rating != null && existing.rating == null) patch.rating = rating;
        if (it.notes && (!existing.notes || existing.notes.length === 0)) patch.notes = it.notes;
        if (
          Array.isArray(it.user_tags) &&
          it.user_tags.length > 0 &&
          (!existing.tags || existing.tags.length === 0)
        )
          patch.tags = it.user_tags;
        if (it.progress != null && existing.progress == null) patch.progress = it.progress;
        if (it.started_at && !existing.started_at) patch.started_at = it.started_at;
        if (it.completed_at && !existing.completed_at) patch.completed_at = it.completed_at;
        if (it.rewatch_count != null && (existing.rewatch_count ?? 0) === 0)
          patch.rewatch_count = it.rewatch_count;
        if (it.is_rewatching && !existing.is_rewatching) patch.is_rewatching = it.is_rewatching;
        if (!existing.import_provider) patch.import_provider = it.provider;
        if (it.provider_ref && !existing.import_ref) patch.import_ref = it.provider_ref;
      }

      const { error: upErr } = await context.supabase.from("list_items").upsert(
        { user_id: context.userId, media_key: it.matched_media_key, ...patch },
        { onConflict: "user_id,media_key" },
      );

      if (upErr) {
        await context.supabase
          .from("import_items")
          .update({ applied_action: "skipped", applied_at: new Date().toISOString() })
          .eq("id", it.id);
        skipped++;
        continue;
      }

      await context.supabase
        .from("import_items")
        .update({
          applied_action: existing ? "updated" : "created",
          applied_at: new Date().toISOString(),
          previous_item: existing ?? null,
        })
        .eq("id", it.id);
      if (existing) updated++;
      else created++;
    }

    await context.supabase
      .from("import_batches")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", data.batchId);

    return { created, updated, skipped };
  });

// ---------- rollback (reverts only this batch's changes) ----------
export const rollbackImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { batchId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: items, error } = await context.supabase
      .from("import_items")
      .select("id,matched_media_key,applied_action,previous_item")
      .eq("batch_id", data.batchId);
    if (error) throw new Error(error.message);

    let reverted = 0;
    for (const it of items ?? []) {
      if (!it.matched_media_key) continue;
      if (it.applied_action === "created") {
        await context.supabase
          .from("list_items")
          .delete()
          .eq("user_id", context.userId)
          .eq("media_key", it.matched_media_key);
        reverted++;
      } else if (it.applied_action === "updated" && it.previous_item) {
        const prev = it.previous_item as {
          status?: "a_voir" | "en_cours" | "termine" | "en_pause" | "abandonne" | null;
          favorite?: boolean;
          priority?: "basse" | "normale" | "haute";
          rating?: number | null;
          notes?: string;
          tags?: string[];
        };
        await context.supabase
          .from("list_items")
          .update({
            status: prev.status ?? null,
            favorite: prev.favorite ?? false,
            priority: prev.priority ?? "normale",
            rating: prev.rating ?? null,
            notes: prev.notes ?? "",
            tags: prev.tags ?? [],
          })
          .eq("user_id", context.userId)
          .eq("media_key", it.matched_media_key);
        reverted++;
      }
    }

    await context.supabase
      .from("import_batches")
      .update({ status: "rolled_back" })
      .eq("id", data.batchId);

    return { reverted };
  });

// ---------- delete batch ----------
export const deleteImportBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { batchId: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("import_batches")
      .delete()
      .eq("id", data.batchId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
