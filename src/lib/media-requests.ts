import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

// Member "missing title" requests (Phase A.1). Members can propose a title
// that is not yet in KAZEN. During beta only the Owner reviews them. RLS on
// the media_requests table enforces: members see/create their own, Owner
// reads all and updates status.

export type MediaRequestType = "anime" | "series" | "film";
export type MediaRequestStatus =
  | "received"
  | "reviewing"
  | "accepted"
  | "rejected"
  | "duplicate";

export const MEDIA_REQUEST_TYPE_LABELS: Record<MediaRequestType, string> = {
  anime: "Anime",
  series: "Série",
  film: "Film",
};

export const MEDIA_REQUEST_STATUS_LABELS: Record<MediaRequestStatus, string> = {
  received: "Reçue",
  reviewing: "En cours d'examen",
  accepted: "Acceptée",
  rejected: "Refusée",
  duplicate: "Doublon",
};

export interface MediaRequest {
  id: string;
  requesterId: string;
  title: string;
  mediaType: MediaRequestType;
  externalUrl: string;
  note: string;
  status: MediaRequestStatus;
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
}

interface MediaRequestRow {
  id: string;
  requester_id: string;
  title: string;
  media_type: string;
  external_url: string;
  note: string;
  status: string;
  review_note: string;
  created_at: string;
  updated_at: string;
}

function mapRow(r: MediaRequestRow): MediaRequest {
  return {
    id: r.id,
    requesterId: r.requester_id,
    title: r.title,
    mediaType: r.media_type as MediaRequestType,
    externalUrl: r.external_url,
    note: r.note,
    status: r.status as MediaRequestStatus,
    reviewNote: r.review_note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** The current member's own requests (received/reviewing/…). */
export function useMyMediaRequests() {
  const { user, ready } = useAuth();
  return useQuery({
    queryKey: ["media-requests", "mine", user?.id],
    enabled: ready && Boolean(user),
    staleTime: 30_000,
    queryFn: async (): Promise<MediaRequest[]> => {
      const { data, error } = await supabase
        .from("media_requests")
        .select("id,requester_id,title,media_type,external_url,note,status,review_note,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapRow(r as MediaRequestRow));
    },
  });
}

/** Owner-only: all requests (RLS returns rows only when caller is Owner). */
export function useAllMediaRequests(enabled: boolean) {
  return useQuery({
    queryKey: ["media-requests", "all"],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<MediaRequest[]> => {
      const { data, error } = await supabase
        .from("media_requests")
        .select("id,requester_id,title,media_type,external_url,note,status,review_note,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapRow(r as MediaRequestRow));
    },
  });
}

export function useMediaRequestMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const submit = useMutation({
    mutationFn: async (input: {
      title: string;
      mediaType: MediaRequestType;
      externalUrl?: string;
      note?: string;
    }) => {
      if (!user) throw new Error("not-auth");
      const { error } = await supabase.from("media_requests").insert({
        requester_id: user.id,
        title: input.title.trim().slice(0, 200),
        media_type: input.mediaType,
        external_url: (input.externalUrl ?? "").trim().slice(0, 500),
        note: (input.note ?? "").trim().slice(0, 1000),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media-requests"] }),
  });

  // Owner-only review; RLS rejects non-owners.
  const review = useMutation({
    mutationFn: async (input: {
      id: string;
      status: MediaRequestStatus;
      reviewNote?: string;
    }) => {
      if (!user) throw new Error("not-auth");
      const { error } = await supabase
        .from("media_requests")
        .update({
          status: input.status,
          review_note: (input.reviewNote ?? "").trim().slice(0, 1000),
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media-requests"] }),
  });

  return { submit, review };
}
