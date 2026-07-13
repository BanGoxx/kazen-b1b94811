import { useCallback, useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  requestConversation,
  acceptConversation,
  declineConversation,
  sendChatMessage,
  editChatMessage,
  deleteChatMessage,
  markConversationRead,
  archiveConversation,
  blockChatMember,
} from "@/lib/chat.functions";

// KAZEN Phase 13 — client-side chat data layer.
// Reads go through the browser client under RLS (participant-only). Realtime is
// intentionally NOT used in this phase; freshness comes from a bounded 10s
// refetch that React Query pauses automatically when the tab is hidden. No
// global subscription, no hidden high-frequency polling.

export type ConvStatus = "pending" | "active" | "blocked" | "closed";

export interface ChatProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface InboxConversation {
  id: string;
  status: ConvStatus;
  requestedBy: string;
  lastMessageAt: string | null;
  createdAt: string;
  other: ChatProfile | null;
  myLastReadAt: string | null;
  archivedAt: string | null;
  iBlocked: boolean;
  otherBlocked: boolean;
  preview: string | null;
  unread: boolean;
  isRequestToMe: boolean;
  amRequester: boolean;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

// Phase 13.1 — polling hardening. Realtime stays OFF; these bounded fallbacks
// only run on authenticated surfaces and React Query pauses them when the tab
// is hidden (refetchIntervalInBackground stays false). The inbox/unread bell is
// mounted globally in the shell, so it polls slowly; the active thread polls at
// a mid interval. Mutations invalidate the ["chat"] tree for immediate refresh,
// so polling is a true fallback, not the primary update path.
const INBOX_REFRESH_MS = 60_000;
const CONVERSATION_REFRESH_MS = 25_000;
const MESSAGES_REFRESH_MS = 25_000;

export function useChatInbox() {
  const { user } = useAuth();
  const uid = user?.id ?? null;

  return useQuery({
    queryKey: ["chat", "inbox", uid],
    enabled: !!uid,
    refetchInterval: INBOX_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async (): Promise<InboxConversation[]> => {
      if (!uid) return [];
      const { data: convs, error } = await supabase
        .from("chat_conversations")
        .select("id, status, requested_by, last_message_at, created_at")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const ids = (convs ?? []).map((c) => c.id);
      if (ids.length === 0) return [];

      const { data: parts } = await supabase
        .from("chat_participants")
        .select("conversation_id, user_id, last_read_at, archived_at, blocked_at")
        .in("conversation_id", ids);

      const otherIds = Array.from(
        new Set(
          (parts ?? [])
            .filter((p) => p.user_id !== uid)
            .map((p) => p.user_id),
        ),
      );
      const profileMap = new Map<string, ChatProfile>();
      if (otherIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", otherIds);
        (profs ?? []).forEach((p) => profileMap.set(p.id, p));
      }

      // Bounded preview/unread source: recent messages across my conversations.
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("conversation_id, sender_id, body, created_at, deleted_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
        .limit(200);

      const latestByConv = new Map<
        string,
        { body: string; created_at: string; sender_id: string; deleted_at: string | null }
      >();
      (msgs ?? []).forEach((m) => {
        if (!latestByConv.has(m.conversation_id)) {
          latestByConv.set(m.conversation_id, {
            body: m.body,
            created_at: m.created_at,
            sender_id: m.sender_id,
            deleted_at: m.deleted_at,
          });
        }
      });

      return (convs ?? []).map((c): InboxConversation => {
        const mine = (parts ?? []).find(
          (p) => p.conversation_id === c.id && p.user_id === uid,
        );
        const others = (parts ?? []).filter(
          (p) => p.conversation_id === c.id && p.user_id !== uid,
        );
        const other = others[0] ? profileMap.get(others[0].user_id) ?? null : null;
        const last = latestByConv.get(c.id) ?? null;
        const lastReadAt = mine?.last_read_at ?? null;
        const unread =
          !!last &&
          last.sender_id !== uid &&
          (!lastReadAt || new Date(last.created_at) > new Date(lastReadAt));
        return {
          id: c.id,
          status: c.status as ConvStatus,
          requestedBy: c.requested_by,
          lastMessageAt: c.last_message_at,
          createdAt: c.created_at,
          other,
          myLastReadAt: lastReadAt,
          archivedAt: mine?.archived_at ?? null,
          iBlocked: !!mine?.blocked_at,
          otherBlocked: others.some((p) => !!p.blocked_at),
          preview: last
            ? last.deleted_at
              ? "Message supprimé"
              : last.body
            : null,
          unread,
          isRequestToMe: c.status === "pending" && c.requested_by !== uid,
          amRequester: c.requested_by === uid,
        };
      });
    },
  });
}

/** Total unread conversations (badge). Distinct from the notification bell. */
export function useChatUnreadCount(): number {
  const { data } = useChatInbox();
  return useMemo(
    () => (data ?? []).filter((c) => c.unread || c.isRequestToMe).length,
    [data],
  );
}

export function useConversation(id: string | undefined) {
  const { user } = useAuth();
  const uid = user?.id ?? null;

  return useQuery({
    queryKey: ["chat", "conversation", id, uid],
    enabled: !!id && !!uid,
    refetchInterval: CONVERSATION_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => {
      if (!id || !uid) return null;
      const { data: conv, error } = await supabase
        .from("chat_conversations")
        .select("id, status, requested_by, last_message_at, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!conv) return null;
      const { data: parts } = await supabase
        .from("chat_participants")
        .select("user_id, last_read_at, archived_at, blocked_at")
        .eq("conversation_id", id);
      const otherPart = (parts ?? []).find((p) => p.user_id !== uid) ?? null;
      const minePart = (parts ?? []).find((p) => p.user_id === uid) ?? null;
      let other: ChatProfile | null = null;
      if (otherPart) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .eq("id", otherPart.user_id)
          .maybeSingle();
        other = prof ?? null;
      }
      return {
        id: conv.id,
        status: conv.status as ConvStatus,
        requestedBy: conv.requested_by,
        other,
        iBlocked: !!minePart?.blocked_at,
        otherBlocked: (parts ?? []).some(
          (p) => p.user_id !== uid && !!p.blocked_at,
        ),
        isRequestToMe:
          conv.status === "pending" && conv.requested_by !== uid,
        amRequester: conv.requested_by === uid,
        archived: !!minePart?.archived_at,
      };
    },
  });
}

export function useMessages(id: string | undefined, limit: number) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  return useQuery({
    queryKey: ["chat", "messages", id, limit, uid],
    enabled: !!id && !!uid,
    refetchInterval: MESSAGES_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async (): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
      if (!id) return { messages: [], hasMore: false };
      const { data, error } = await supabase
        .from("chat_messages")
        .select(
          "id, conversation_id, sender_id, body, created_at, edited_at, deleted_at",
        )
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .limit(limit + 1);
      if (error) throw error;
      const rows = data ?? [];
      const hasMore = rows.length > limit;
      const trimmed = hasMore ? rows.slice(0, limit) : rows;
      return { messages: trimmed.reverse() as ChatMessage[], hasMore };
    },
  });
}

// --- Mutations ---------------------------------------------------------------

export function useChatMutations() {
  const qc = useQueryClient();
  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["chat"] });
  }, [qc]);

  const request = useServerFn(requestConversation);
  const accept = useServerFn(acceptConversation);
  const decline = useServerFn(declineConversation);
  const send = useServerFn(sendChatMessage);
  const edit = useServerFn(editChatMessage);
  const del = useServerFn(deleteChatMessage);
  const markRead = useServerFn(markConversationRead);
  const archive = useServerFn(archiveConversation);
  const block = useServerFn(blockChatMember);

  const requestMut = useMutation({
    mutationFn: (target: string) => request({ data: { target } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const acceptMut = useMutation({
    mutationFn: (id: string) => accept({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const declineMut = useMutation({
    mutationFn: (id: string) => decline({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const sendMut = useMutation({
    mutationFn: (v: { conversationId: string; body: string }) =>
      send({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const editMut = useMutation({
    mutationFn: (v: { id: string; body: string }) => edit({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const markReadMut = useMutation({
    mutationFn: (id: string) => markRead({ data: { id } }),
    onSuccess: invalidate,
  });
  const archiveMut = useMutation({
    mutationFn: (v: { id: string; archived: boolean }) => archive({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const blockMut = useMutation({
    mutationFn: (v: { id: string; blocked: boolean }) => block({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    requestMut,
    acceptMut,
    declineMut,
    sendMut,
    editMut,
    deleteMut,
    markReadMut,
    archiveMut,
    blockMut,
  };
}
