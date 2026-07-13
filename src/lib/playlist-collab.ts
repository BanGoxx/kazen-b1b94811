import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

// Listes partagées v2 — collaboration.
// Le propriétaire peut inviter/retirer des collaborateurs et traiter les
// demandes d'adhésion ; les collaborateurs « éditeur » peuvent modifier les
// éléments de la liste (RLS applique tout côté base).

export type CollabRole = "viewer" | "editor";
export type PlaylistRole = "owner" | "editor" | "viewer" | null;
export type RequestStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface CollaboratorRow {
  id: string;
  userId: string;
  role: CollabRole;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface JoinRequestRow {
  id: string;
  requesterId: string;
  status: RequestStatus;
  message: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

// --- My role on a playlist --------------------------------------------------

export function useMyPlaylistRole(playlistId: string, ownerId: string | undefined) {
  const { user, ready } = useAuth();
  return useQuery({
    queryKey: ["playlist-role", playlistId, user?.id],
    enabled: ready && Boolean(user) && Boolean(ownerId),
    staleTime: 30_000,
    queryFn: async (): Promise<PlaylistRole> => {
      if (!user) return null;
      if (ownerId && user.id === ownerId) return "owner";
      const { data, error } = await supabase
        .from("playlist_collaborators")
        .select("role")
        .eq("playlist_id", playlistId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? (data.role as CollabRole) : null;
    },
  });
}

// --- Lists shared with me ---------------------------------------------------

export interface SharedListCard {
  id: string;
  title: string;
  description: string;
  role: CollabRole;
  ownerName: string;
  updatedAt: string;
  count: number;
}

export function useSharedWithMe() {
  const { user, ready } = useAuth();
  return useQuery({
    queryKey: ["shared-with-me", user?.id],
    enabled: ready && Boolean(user),
    staleTime: 30_000,
    queryFn: async (): Promise<SharedListCard[]> => {
      const { data, error } = await supabase
        .from("playlist_collaborators")
        .select(
          "role,playlist_id,playlists(id,owner_id,title,description,updated_at,playlist_items(id))",
        )
        .eq("user_id", user!.id);
      if (error) throw new Error(error.message);
      const rows = (data ?? []).filter((r) => r.playlists);
      const ownerIds = [
        ...new Set(
          rows.map((r) => (r.playlists as { owner_id: string }).owner_id).filter(Boolean),
        ),
      ];
      const { data: profiles } = ownerIds.length
        ? await supabase.from("profiles").select("id,display_name").in("id", ownerIds)
        : { data: [] as { id: string; display_name: string | null }[] };
      const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
      return rows
        .map((r) => {
          const pl = r.playlists as {
            id: string;
            owner_id: string;
            title: string;
            description: string;
            updated_at: string;
            playlist_items?: { id: string }[];
          };
          return {
            id: pl.id,
            title: pl.title,
            description: pl.description ?? "",
            role: r.role as CollabRole,
            ownerName: nameMap.get(pl.owner_id) || "Membre KAZEN",
            updatedAt: pl.updated_at,
            count: Array.isArray(pl.playlist_items) ? pl.playlist_items.length : 0,
          };
        })
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    },
  });
}

// --- Collaborators of a playlist (owner view) -------------------------------

export function usePlaylistCollaborators(playlistId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["playlist-collaborators", playlistId],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<CollaboratorRow[]> => {
      const { data, error } = await supabase
        .from("playlist_collaborators")
        .select("id,user_id,role,created_at")
        .eq("playlist_id", playlistId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const ids = rows.map((r) => r.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id,display_name,avatar_url").in("id", ids)
        : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };
      const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        role: r.role as CollabRole,
        displayName: pMap.get(r.user_id)?.display_name || "Membre KAZEN",
        avatarUrl: pMap.get(r.user_id)?.avatar_url ?? null,
        createdAt: r.created_at,
      }));
    },
  });
}

// --- Join requests (owner view) ---------------------------------------------

export function usePlaylistJoinRequests(playlistId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["playlist-requests", playlistId],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<JoinRequestRow[]> => {
      const { data, error } = await supabase
        .from("playlist_requests")
        .select("id,requester_id,status,message,created_at")
        .eq("playlist_id", playlistId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const ids = rows.map((r) => r.requester_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id,display_name,avatar_url").in("id", ids)
        : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };
      const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        id: r.id,
        requesterId: r.requester_id,
        status: r.status as RequestStatus,
        message: r.message ?? "",
        displayName: pMap.get(r.requester_id)?.display_name || "Membre KAZEN",
        avatarUrl: pMap.get(r.requester_id)?.avatar_url ?? null,
        createdAt: r.created_at,
      }));
    },
  });
}

// --- My own join request (member view) --------------------------------------

export function useMyJoinRequest(playlistId: string, canRequest: boolean) {
  const { user, ready } = useAuth();
  return useQuery({
    queryKey: ["my-join-request", playlistId, user?.id],
    enabled: ready && Boolean(user) && canRequest,
    staleTime: 15_000,
    queryFn: async (): Promise<RequestStatus | null> => {
      const { data, error } = await supabase
        .from("playlist_requests")
        .select("status")
        .eq("playlist_id", playlistId)
        .eq("requester_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? (data.status as RequestStatus) : null;
    },
  });
}

// --- Mutations --------------------------------------------------------------

export function useCollabMutations(playlistId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["playlist-collaborators", playlistId] });
    qc.invalidateQueries({ queryKey: ["playlist-requests", playlistId] });
    qc.invalidateQueries({ queryKey: ["my-join-request", playlistId] });
    qc.invalidateQueries({ queryKey: ["playlist-role", playlistId] });
    qc.invalidateQueries({ queryKey: ["shared-with-me"] });
  };

  const requestToJoin = useMutation({
    mutationFn: async (message: string) => {
      if (!user) throw new Error("not-auth");
      const { error } = await supabase.rpc("request_playlist_join", {
        _playlist: playlistId,
        _message: message.trim().slice(0, 500),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });

  const cancelRequest = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not-auth");
      const { error } = await supabase
        .from("playlist_requests")
        .update({ status: "cancelled", decided_by: user.id, decided_at: new Date().toISOString() })
        .eq("playlist_id", playlistId)
        .eq("requester_id", user.id)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });

  const acceptRequest = useMutation({
    mutationFn: async (req: { id: string; requesterId: string }) => {
      if (!user) throw new Error("not-auth");
      const { error: insErr } = await supabase.from("playlist_collaborators").insert({
        playlist_id: playlistId,
        user_id: req.requesterId,
        role: "editor",
        invited_by: user.id,
      });
      if (insErr && !insErr.message.includes("duplicate")) throw new Error(insErr.message);
      const { error } = await supabase
        .from("playlist_requests")
        .update({ status: "accepted", decided_by: user.id, decided_at: new Date().toISOString() })
        .eq("id", req.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });

  const declineRequest = useMutation({
    mutationFn: async (requestId: string) => {
      if (!user) throw new Error("not-auth");
      const { error } = await supabase
        .from("playlist_requests")
        .update({ status: "declined", decided_by: user.id, decided_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });

  const setRole = useMutation({
    mutationFn: async (input: { collaboratorId: string; role: CollabRole }) => {
      const { error } = await supabase
        .from("playlist_collaborators")
        .update({ role: input.role })
        .eq("id", input.collaboratorId);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });

  const removeCollaborator = useMutation({
    mutationFn: async (collaboratorId: string) => {
      const { error } = await supabase
        .from("playlist_collaborators")
        .delete()
        .eq("id", collaboratorId);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });

  const leave = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not-auth");
      const { error } = await supabase
        .from("playlist_collaborators")
        .delete()
        .eq("playlist_id", playlistId)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });

  return {
    requestToJoin,
    cancelRequest,
    acceptRequest,
    declineRequest,
    setRole,
    removeCollaborator,
    leave,
  };
}
