import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// KAZEN Phase 13 — Private 1:1 chat server functions.
//
// Every write is funneled through a SECURITY DEFINER database RPC that derives
// the acting member from auth.uid() and enforces eligibility (participant-only,
// active-conversation, block state, length, rate limits) internally. These
// server functions are thin, auth-checked wrappers — RLS + the DB functions are
// the real enforcement layer. No sender/participant identity is ever trusted
// from the client.

export const requestConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { target: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc(
      "request_conversation",
      { _target: data.target },
    );
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const acceptConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("accept_conversation", {
      _id: data.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const declineConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("decline_conversation", {
      _id: data.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string; body: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("send_chat_message", {
      _conv: data.conversationId,
      _body: data.body,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const editChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; body: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("edit_chat_message", {
      _id: data.id,
      _body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("delete_chat_message", {
      _id: data.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("mark_conversation_read", {
      _id: data.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const archiveConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; archived: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("archive_conversation", {
      _id: data.id,
      _archived: data.archived,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const blockChatMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; blocked: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("block_chat_member", {
      _id: data.id,
      _blocked: data.blocked,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reportChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { id: string; reason: string; details?: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc(
      "report_chat_message",
      { _id: data.id, _reason: data.reason, _details: data.details ?? "" },
    );
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

// Member preference: allow/disallow new incoming chat requests.
export const setAcceptsChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { accepts: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ accepts_chat: data.accepts })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
