import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import type { MediaSource } from "./media-types";

// KAZEN Phase 21 — member fiche correction requests.
//
// Authenticated members can flag a problem on a fiche (wrong poster, synopsis,
// platform, franchise relation, season, duplicate, missing title, metadata,
// broken trailer, other). Requests are plain text, bounded, never public, and
// NEVER auto-edit catalogue data. Only the Owner reviews them. Security is
// enforced server-side via RLS (auth.uid() identity, owner-only review), a
// duplicate-open index, and a per-hour rate-limit trigger.

export type CorrectionCategory =
  | "incorrect_poster"
  | "incorrect_synopsis"
  | "missing_platform"
  | "wrong_relation"
  | "incorrect_season"
  | "duplicate"
  | "missing_title"
  | "incorrect_metadata"
  | "broken_trailer"
  | "other";

export type CorrectionStatus =
  | "received"
  | "reviewing"
  | "need_info"
  | "accepted"
  | "rejected";

export const CORRECTION_CATEGORY_LABELS: Record<CorrectionCategory, string> = {
  incorrect_poster: "Affiche incorrecte",
  incorrect_synopsis: "Synopsis incorrect",
  missing_platform: "Plateforme manquante",
  wrong_relation: "Relation de franchise erronée",
  incorrect_season: "Saison incorrecte",
  duplicate: "Doublon",
  missing_title: "Titre manquant",
  incorrect_metadata: "Métadonnée incorrecte",
  broken_trailer: "Bande-annonce cassée",
  other: "Autre",
};

export const CORRECTION_CATEGORY_ORDER: CorrectionCategory[] = [
  "incorrect_poster",
  "incorrect_synopsis",
  "missing_platform",
  "wrong_relation",
  "incorrect_season",
  "duplicate",
  "incorrect_metadata",
  "broken_trailer",
  "missing_title",
  "other",
];

export const CORRECTION_STATUS_LABELS: Record<CorrectionStatus, string> = {
  received: "Reçue",
  reviewing: "En cours d'examen",
  need_info: "Complément demandé",
  accepted: "Acceptée",
  rejected: "Refusée",
};

export const MAX_CORRECTION_BODY = 1200;

export interface CorrectionRequest {
  id: string;
  requesterId: string;
  source: MediaSource;
  externalId: string;
  mediaTitle: string;
  category: CorrectionCategory;
  body: string;
  status: CorrectionStatus;
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
}

interface CorrectionRow {
  id: string;
  requester_id: string;
  source: string;
  external_id: string;
  media_title: string;
  category: string;
  body: string;
  status: string;
  review_note: string;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  "id,requester_id,source,external_id,media_title,category,body,status,review_note,created_at,updated_at";

function mapRow(r: CorrectionRow): CorrectionRequest {
  return {
    id: r.id,
    requesterId: r.requester_id,
    source: r.source as MediaSource,
    externalId: r.external_id,
    mediaTitle: r.media_title,
    category: r.category as CorrectionCategory,
    body: r.body,
    status: r.status as CorrectionStatus,
    reviewNote: r.review_note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** The current member's own correction requests for a specific fiche. */
export function useMyFicheCorrections(source: string, externalId: string) {
  const { user, ready } = useAuth();
  return useQuery({
    queryKey: ["fiche-corrections", "mine", user?.id, source, externalId],
    enabled: ready && Boolean(user),
    staleTime: 30_000,
    queryFn: async (): Promise<CorrectionRequest[]> => {
      const { data, error } = await supabase
        .from("fiche_correction_requests")
        .select(COLUMNS)
        .eq("source", source)
        .eq("external_id", externalId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapRow(r as CorrectionRow));
    },
  });
}

/**
 * Owner-only: bounded, paginated list of correction requests. RLS returns rows
 * only when the caller is the Owner. `limit` keeps the list bounded (no
 * "load everything") and `category` powers server-side filtering.
 */
export function useAllFicheCorrections(
  enabled: boolean,
  opts: { category?: CorrectionCategory | "all"; limit?: number } = {},
) {
  const { category = "all", limit = 100 } = opts;
  return useQuery({
    queryKey: ["fiche-corrections", "all", category, limit],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<CorrectionRequest[]> => {
      let q = supabase
        .from("fiche_correction_requests")
        .select(COLUMNS)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (category !== "all") q = q.eq("category", category);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapRow(r as CorrectionRow));
    },
  });
}

export function useFicheCorrectionMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const submit = useMutation({
    mutationFn: async (input: {
      source: string;
      externalId: string;
      mediaTitle: string;
      category: CorrectionCategory;
      body: string;
    }) => {
      if (!user) throw new Error("not-auth");
      const body = input.body.trim();
      if (!body) throw new Error("empty-body");
      const { error } = await supabase
        .from("fiche_correction_requests")
        .insert({
          requester_id: user.id,
          source: input.source.slice(0, 32),
          external_id: input.externalId.slice(0, 64),
          media_title: input.mediaTitle.trim().slice(0, 300),
          category: input.category,
          body: body.slice(0, MAX_CORRECTION_BODY),
        });
      if (error) {
        // Surface actionable French errors for the two guarded cases.
        if (/rate_limit_exceeded/i.test(error.message)) throw new Error("rate-limit");
        if (/duplicate|unique/i.test(error.message)) throw new Error("duplicate");
        throw new Error(error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fiche-corrections"] }),
  });

  // Owner-only review; RLS rejects non-owners. Reviewing records an audit trail
  // via reviewed_by / reviewed_at / status transition — it NEVER edits the
  // catalogue.
  const review = useMutation({
    mutationFn: async (input: {
      id: string;
      status: CorrectionStatus;
      reviewNote?: string;
    }) => {
      if (!user) throw new Error("not-auth");
      const { error } = await supabase
        .from("fiche_correction_requests")
        .update({
          status: input.status,
          review_note: (input.reviewNote ?? "").trim().slice(0, MAX_CORRECTION_BODY),
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fiche-corrections"] }),
  });

  return { submit, review };
}
