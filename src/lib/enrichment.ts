import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  MediaDetail,
  RelatedMedia,
  CreditPerson,
  Platform,
} from "./media-types";

// KAZEN Data Enrichment Layer — Phase 1.
//
// A KAZEN-owned layer that SUPPLEMENTS AniList/TMDB. Providers stay the
// primary automatic source; enrichment only fills, corrects or overrides
// missing/weak fields when the Owner explicitly published them.
//
// Public read is limited to the safe, published fields returned by the
// SECURITY DEFINER RPC `get_public_enrichment` (private notes never leave
// the database).

export type DataQualityStatus =
  | "complete"
  | "partial"
  | "provider_limited"
  | "needs_review";

export const DATA_QUALITY_LABELS: Record<DataQualityStatus, string> = {
  complete: "Complète",
  partial: "Partielle",
  provider_limited: "Limitée par la source",
  needs_review: "À revoir",
};

/** Safe, publicly-readable enrichment shape (never includes private notes). */
export interface PublicEnrichment {
  source: string;
  external_id: string;
  title_override: string | null;
  native_title_override: string | null;
  synopsis_override: string | null;
  poster_url_override: string | null;
  backdrop_url_override: string | null;
  status_note: string | null;
  data_quality_status: DataQualityStatus | null;
  extra_titles: string[] | null;
  extra_relations: Partial<RelatedMedia>[] | null;
  extra_characters: CreditPerson[] | null;
  extra_staff: CreditPerson[] | null;
  extra_sources: string[] | null;
  extra_platforms: Platform[] | null;
  external_links: { label: string; url: string }[] | null;
}

/** Public, non-blocking read of published enrichment for a fiche. */
export const publicEnrichmentQO = (source: string, id: string) =>
  queryOptions({
    queryKey: ["enrichment", "public", source, id],
    queryFn: async (): Promise<PublicEnrichment | null> => {
      const { data, error } = await supabase.rpc("get_public_enrichment", {
        _source: source,
        _external_id: id,
      });
      if (error) {
        console.error("get_public_enrichment", error);
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      return (row as PublicEnrichment) ?? null;
    },
    staleTime: 1000 * 60 * 60,
    // Enrichment is a supplement: a miss must never break the fiche.
    retry: 0,
  });

function nonEmpty(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function dedupeByKey<T extends { key?: string | null }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = it.key ?? JSON.stringify(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/**
 * Compose the final fiche in the documented order:
 *   provider data → cached provider data → KAZEN enrichment.
 * Overrides win only when explicitly provided; extra collections merge without
 * duplicating existing provider entries. Never removes provider data.
 */
export function applyEnrichment(
  item: MediaDetail,
  enr: PublicEnrichment | null | undefined,
): MediaDetail {
  if (!enr) return item;
  const next: MediaDetail = { ...item };

  if (nonEmpty(enr.title_override)) next.title = enr.title_override;
  if (nonEmpty(enr.native_title_override))
    next.titleOriginal = enr.native_title_override;
  // Synopsis: explicit override always wins; otherwise fill only when missing.
  if (nonEmpty(enr.synopsis_override)) next.synopsis = enr.synopsis_override;
  if (nonEmpty(enr.poster_url_override))
    next.posterUrl = enr.poster_url_override;
  if (nonEmpty(enr.backdrop_url_override))
    next.backdropUrl = enr.backdrop_url_override;

  // Extra titles → titleAlternatives (dedupe).
  if (enr.extra_titles?.length) {
    next.titleAlternatives = Array.from(
      new Set([...(item.titleAlternatives ?? []), ...enr.extra_titles]),
    );
  }

  // Extra relations → merge, dedupe by key, preserving provider entries.
  if (enr.extra_relations?.length) {
    const merged = [
      ...item.related,
      ...(enr.extra_relations.filter((r) => r && r.key) as RelatedMedia[]),
    ];
    next.related = dedupeByKey(merged);
  }

  // Curated characters / staff → merge (or supply when provider gave none).
  if (enr.extra_characters?.length) {
    next.cast = dedupeByKey([...(item.cast ?? []), ...enr.extra_characters]);
  }
  if (enr.extra_staff?.length) {
    next.crew = dedupeByKey([...(item.crew ?? []), ...enr.extra_staff]);
  }

  // Extra platforms → merge, dedupe by key.
  if (enr.extra_platforms?.length) {
    next.platforms = dedupeByKey([
      ...(item.platforms ?? []),
      ...enr.extra_platforms,
    ]);
  }

  return next;
}

/** QA signals used by the Founder Console and the limited-data fallback. */
export interface QaFlags {
  missingSynopsis: boolean;
  missingCharacters: boolean;
  missingStaff: boolean;
  missingRelations: boolean;
  providerLimited: boolean;
}

export function computeQaFlags(item: MediaDetail | null | undefined): QaFlags {
  return {
    missingSynopsis: !item || !nonEmpty(item.synopsis),
    missingCharacters: !item || !item.cast?.length,
    missingStaff: !item || !item.crew?.length,
    missingRelations: !item || !item.related?.length,
    providerLimited:
      !item ||
      (!nonEmpty(item.synopsis) && !item.cast?.length && !item.crew?.length),
  };
}

/**
 * A fiche is "clearly incomplete" when the core narrative content is missing.
 * Only then do we surface the restrained limited-data state.
 */
export function isFicheLimited(item: MediaDetail | null | undefined): boolean {
  if (!item) return true;
  const flags = computeQaFlags(item);
  return flags.missingSynopsis && flags.missingCharacters && flags.missingRelations;
}
