import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// KAZEN Phase 25 — Authenticated Community Live Chat (server functions).
//
// Every write is enforced by a SECURITY DEFINER RPC (identity from auth.uid()),
// so these wrappers stay thin and never trust client-supplied author identity.

export const sendLiveChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { roomId: string; body: string; replyTo?: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc(
      "send_live_chat_message",
      { _room: data.roomId, _body: data.body, _reply_to: data.replyTo ?? undefined },
    );
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const editLiveChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; body: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("edit_live_chat_message", {
      _id: data.id,
      _body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLiveChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("delete_live_chat_message", {
      _id: data.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markLiveChatRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roomId: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("mark_live_chat_read", {
      _room: data.roomId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reportLiveChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { id: string; reason: string; details?: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc(
      "report_live_chat_message",
      { _id: data.id, _reason: data.reason, _details: data.details ?? "" },
    );
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const hideLiveChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("hide_live_chat_message", {
      _id: data.id,
      _reason: data.reason ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const restoreLiveChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("restore_live_chat_message", {
      _id: data.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const restrictLiveChatMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      roomId: string;
      userId: string;
      minutes: number;
      reason?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("restrict_live_chat_member", {
      _room: data.roomId,
      _user: data.userId,
      _minutes: data.minutes,
      _reason: data.reason ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unrestrictLiveChatMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roomId: string; userId: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc(
      "unrestrict_live_chat_member",
      { _room: data.roomId, _user: data.userId },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setLiveChatRoomActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roomId: string; active: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_live_chat_room_active", {
      _room: data.roomId,
      _active: data.active,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getLiveChatAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc(
      "live_chat_admin_stats",
    );
    if (error) throw new Error(error.message);
    return (data ?? {}) as {
      rooms?: Array<{ id: string; slug: string; name: string; is_active: boolean }>;
      messages_today?: number;
      unique_authors_today?: number;
      hidden_today?: number;
      restricted_members?: number;
      open_reports?: number;
    };
  });
