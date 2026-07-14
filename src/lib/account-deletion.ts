import { supabase } from "@/integrations/supabase/client";

// KAZEN — Phase 26.1 (C5, RGPD art. 17).
// Membre-side helpers for account-deletion requests. The Owner processes
// the request manually to guarantee UGC anonymization strategy control and
// avoid irreversible destructive migrations. RLS enforces ownership.

export interface AccountDeletionRequest {
  id: string;
  user_id: string;
  reason: string | null;
  status: "pending" | "processed" | "cancelled";
  created_at: string;
  processed_at: string | null;
  notes: string | null;
}

export async function getMyPendingDeletionRequest(): Promise<AccountDeletionRequest | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .select("id, user_id, reason, status, created_at, processed_at, notes")
    .eq("user_id", auth.user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as AccountDeletionRequest | null;
}

export async function createMyDeletionRequest(reason: string | null) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Non connecté.");
  const { error } = await supabase.from("account_deletion_requests").insert({
    user_id: auth.user.id,
    reason: reason?.trim() || null,
    status: "pending",
  });
  if (error) throw new Error(error.message);
}

export async function cancelMyDeletionRequest(id: string) {
  const { error } = await supabase
    .from("account_deletion_requests")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
