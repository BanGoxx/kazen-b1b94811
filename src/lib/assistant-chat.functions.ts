import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface StoredAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

/** Loads the signed-in user's single assistant conversation, oldest first. */
export const getAssistantHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StoredAssistantMessage[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("assistant_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      role: r.role as "user" | "assistant",
      content: r.content as string,
      createdAt: r.created_at as string,
    }));
  });

/** Clears the signed-in user's assistant conversation. */
export const clearAssistantHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("assistant_messages")
      .delete()
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
