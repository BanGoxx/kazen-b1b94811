import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  sendLiveChatMessage,
  editLiveChatMessage,
  deleteLiveChatMessage,
  markLiveChatRead,
  reportLiveChatMessage,
  hideLiveChatMessage,
  restoreLiveChatMessage,
} from "@/lib/live-chat.functions";

// KAZEN Phase 25 — Live community chat client data layer.
// Freshness path: (a) Supabase Realtime subscription filtered by room_id when
// the table is in the publication; (b) bounded polling fallback (React Query
// pauses on hidden tab). Mutations invalidate the query tree.

export const LIVE_CHAT_ROOM_SLUG = "general";
export const LIVE_CHAT_PAGE_SIZE = 40;
const POLL_INTERVAL_MS = 20_000;

// Module-level Realtime connection status per room. Lets the messages query
// gate its polling fallback so it only runs while Realtime is NOT connected.
type RtStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";
const rtStatusByRoom = new Map<string, RtStatus>();
const rtStatusListeners = new Set<() => void>();
function setRtStatus(roomId: string, s: RtStatus) {
  rtStatusByRoom.set(roomId, s);
  rtStatusListeners.forEach((fn) => fn());
}
function useRealtimeConnected(roomId: string | undefined): boolean {
  const [connected, setConnected] = useState(
    !!roomId && rtStatusByRoom.get(roomId) === "connected",
  );
  useEffect(() => {
    if (!roomId) {
      setConnected(false);
      return;
    }
    const update = () =>
      setConnected(rtStatusByRoom.get(roomId) === "connected");
    update();
    rtStatusListeners.add(update);
    return () => {
      rtStatusListeners.delete(update);
    };
  }, [roomId]);
  return connected;
}

export interface LiveChatAuthor {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface LiveChatMessage {
  id: string;
  room_id: string;
  author_id: string;
  body: string;
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  hidden_at: string | null;
  author: LiveChatAuthor | null;
}

export interface LiveChatRoom {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface LiveChatMemberState {
  last_read_at: string | null;
  restricted_until: string | null;
  restricted_reason: string | null;
}

export function useLiveChatRoom() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["live-chat", "room", LIVE_CHAT_ROOM_SLUG],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<LiveChatRoom | null> => {
      const { data, error } = await supabase
        .from("live_chat_rooms")
        .select("id, slug, name, description, is_active")
        .eq("slug", LIVE_CHAT_ROOM_SLUG)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as LiveChatRoom | null;
    },
  });
}

export function useLiveChatMemberState(roomId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["live-chat", "state", roomId, user?.id],
    enabled: !!user && !!roomId,
    staleTime: 30_000,
    queryFn: async (): Promise<LiveChatMemberState | null> => {
      if (!roomId || !user) return null;
      const { data, error } = await supabase
        .from("live_chat_member_state")
        .select("last_read_at, restricted_until, restricted_reason")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) return null;
      return data as LiveChatMemberState | null;
    },
  });
}

async function hydrateAuthors(
  rows: Array<Omit<LiveChatMessage, "author">>,
): Promise<LiveChatMessage[]> {
  const ids = Array.from(new Set(rows.map((r) => r.author_id)));
  if (ids.length === 0) return rows.map((r) => ({ ...r, author: null }));
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, profile_public")
    .in("id", ids);
  const map = new Map<string, LiveChatAuthor>();
  for (const p of (data ?? []) as Array<{
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    profile_public: boolean | null;
  }>) {
    map.set(p.id, {
      id: p.id,
      display_name: p.profile_public ? p.display_name : "Membre KAZEN",
      avatar_url: p.profile_public ? p.avatar_url : null,
    });
  }
  return rows.map((r) => ({ ...r, author: map.get(r.author_id) ?? null }));
}

export interface LiveChatCursor {
  created_at: string;
  id: string;
}

export function useLiveChatMessages(roomId: string | undefined) {
  const { user } = useAuth();
  const rtConnected = useRealtimeConnected(roomId);
  type Page = { items: LiveChatMessage[]; nextCursor: LiveChatCursor | null };
  return useInfiniteQuery<
    Page,
    Error,
    { pages: Page[]; pageParams: unknown[] },
    readonly unknown[],
    LiveChatCursor | null
  >({
    queryKey: ["live-chat", "messages", roomId],
    enabled: !!user && !!roomId,
    // Polling is a fallback only: pause it while Realtime is connected so
    // healthy sockets are the single source of freshness. When Realtime is
    // idle/connecting/reconnecting/disconnected we resume the 20s poll.
    refetchInterval: rtConnected ? false : POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    queryFn: async ({ pageParam }) => {
      if (!roomId)
        return { items: [], nextCursor: null as LiveChatCursor | null };
      let query = supabase
        .from("live_chat_messages")
        .select(
          "id, room_id, author_id, body, reply_to_id, created_at, edited_at, deleted_at, hidden_at",
        )
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(LIVE_CHAT_PAGE_SIZE);
      if (pageParam) {
        // Deterministic composite cursor:
        //   created_at < c.created_at
        //   OR (created_at = c.created_at AND id < c.id)
        // Prevents duplicates/gaps when multiple messages share created_at.
        query = query.or(
          `created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`,
        );
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<Omit<LiveChatMessage, "author">>;
      const items = await hydrateAuthors(rows);
      const last = rows[rows.length - 1];
      const nextCursor: LiveChatCursor | null =
        rows.length === LIVE_CHAT_PAGE_SIZE && last
          ? { created_at: last.created_at, id: last.id }
          : null;
      return { items, nextCursor };
    },
  });
}

/** Subscribe to Realtime inserts/updates when the table is in the publication.
 *  Safe no-op if the publication does not include the table yet. */
export function useLiveChatRealtime(roomId: string | undefined) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "reconnecting" | "disconnected"
  >("idle");
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    setStatus("connecting");
    const channel = supabase
      .channel(`live-chat:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          qc.invalidateQueries({
            queryKey: ["live-chat", "messages", roomId],
          });
        },
      )
      .subscribe((s) => {
        if (cancelled) return;
        if (s === "SUBSCRIBED") {
          attemptRef.current = 0;
          setStatus("connected");
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          attemptRef.current += 1;
          setStatus(attemptRef.current > 2 ? "disconnected" : "reconnecting");
        } else if (s === "CLOSED") {
          setStatus("disconnected");
        }
      });
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId, qc]);

  return status;
}

export function useSendLiveChatMessage() {
  const qc = useQueryClient();
  const send = useServerFn(sendLiveChatMessage);
  return useMutation({
    mutationFn: async (input: {
      roomId: string;
      body: string;
      replyTo?: string;
    }) => send({ data: input }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({
        queryKey: ["live-chat", "messages", vars.roomId],
      });
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

export function useEditLiveChatMessage(roomId: string | undefined) {
  const qc = useQueryClient();
  const edit = useServerFn(editLiveChatMessage);
  return useMutation({
    mutationFn: async (input: { id: string; body: string }) =>
      edit({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["live-chat", "messages", roomId] });
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

export function useDeleteLiveChatMessage(roomId: string | undefined) {
  const qc = useQueryClient();
  const del = useServerFn(deleteLiveChatMessage);
  return useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["live-chat", "messages", roomId] });
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

export function useMarkLiveChatRead() {
  const qc = useQueryClient();
  const mark = useServerFn(markLiveChatRead);
  return useMutation({
    mutationFn: async (roomId: string) => mark({ data: { roomId } }),
    onSuccess: (_r, roomId) => {
      qc.invalidateQueries({ queryKey: ["live-chat", "state", roomId] });
    },
  });
}

export function useReportLiveChatMessage() {
  const report = useServerFn(reportLiveChatMessage);
  return useMutation({
    mutationFn: async (input: {
      id: string;
      reason: string;
      details?: string;
    }) => report({ data: input }),
    onSuccess: () => toast.success("Signalement transmis à la modération."),
    onError: (err) => toast.error((err as Error).message),
  });
}

export function useHideLiveChatMessage(roomId: string | undefined) {
  const qc = useQueryClient();
  const hide = useServerFn(hideLiveChatMessage);
  const restore = useServerFn(restoreLiveChatMessage);
  return {
    hide: useMutation({
      mutationFn: async (input: { id: string; reason?: string }) =>
        hide({ data: input }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["live-chat", "messages", roomId] });
        toast.success("Message masqué.");
      },
      onError: (err) => toast.error((err as Error).message),
    }),
    restore: useMutation({
      mutationFn: async (id: string) => restore({ data: { id } }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["live-chat", "messages", roomId] });
        toast.success("Message restauré.");
      },
      onError: (err) => toast.error((err as Error).message),
    }),
  };
}

/** Flatten paginated data into a single chronological list (oldest → newest). */
export function useFlatLiveChatMessages(roomId: string | undefined) {
  const q = useLiveChatMessages(roomId);
  const messages = useMemo(() => {
    const pages = q.data?.pages ?? [];
    const seen = new Set<string>();
    const all: LiveChatMessage[] = [];
    for (const page of pages) {
      for (const m of page.items) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          all.push(m);
        }
      }
    }
    return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [q.data]);
  const loadOlder = useCallback(() => {
    if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
  }, [q]);
  return {
    messages,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    hasOlder: !!q.hasNextPage,
    loadOlder,
    refetch: q.refetch,
    error: q.error,
  };
}

/** Local block set used to hide messages from blocked members client-side. */
export function useBlockedMemberIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["live-chat", "blocked-ids", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user) return new Set<string>();
      const { data } = await supabase
        .from("member_blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id);
      return new Set(
        ((data ?? []) as Array<{ blocked_id: string }>).map(
          (r) => r.blocked_id,
        ),
      );
    },
  });
}
