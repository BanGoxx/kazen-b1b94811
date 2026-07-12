import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

// KAZEN Founder identity + public badge client helpers.
//
// Founder ("Fondateur") identity is derived ONLY from the protected Owner
// role via the SECURITY DEFINER `founder_user_ids()` helper — it can never be
// self-assigned. Public badges are cosmetic identity markers with no
// permission effect; the Owner manages them (RLS-enforced).

export interface PublicBadge {
  id: string;
  label: string;
  description: string;
  visual_variant: string;
  icon_key: string | null;
  is_active: boolean;
}

/** Set of user ids that hold the unique Owner (Fondateur) role. */
export function useFounderIds() {
  return useQuery({
    queryKey: ["founder-ids"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc("founder_user_ids");
      if (error) throw new Error(error.message);
      return ((data as { user_id?: string }[] | string[] | null) ?? []).map(
        (row: any) => (typeof row === "string" ? row : row.user_id ?? row),
      );
    },
    staleTime: 30 * 60 * 1000,
  });
}

/** Is a given user id the Founder? */
export function useIsFounder(userId: string | null | undefined): boolean {
  const { data } = useFounderIds();
  if (!userId || !data) return false;
  return data.includes(userId);
}

/** Is the signed-in user the Owner/Founder? (UI gate only — RLS enforces.) */
export function useIsOwner(): boolean {
  const { user } = useAuth();
  return useIsFounder(user?.id);
}

/** Public, visible badges assigned to a user (safe for anon display). */
export function useUserBadges(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["user-badges", userId],
    enabled: Boolean(userId),
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<PublicBadge[]> => {
      const { data, error } = await supabase
        .from("user_public_badges")
        .select("public_badges(id, label, description, visual_variant, icon_key, is_active)")
        .eq("user_id", userId!)
        .eq("is_visible", true);
      if (error) throw new Error(error.message);
      return ((data ?? []) as any[])
        .map((r) => r.public_badges)
        .filter((b): b is PublicBadge => Boolean(b) && b.is_active);
    },
  });
}

/** The full badge catalog (Owner console). */
export function useBadgeCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ["badge-catalog"],
    enabled,
    queryFn: async (): Promise<PublicBadge[]> => {
      const { data, error } = await supabase
        .from("public_badges")
        .select("id, label, description, visual_variant, icon_key, is_active")
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as PublicBadge[];
    },
  });
}

// Owner-only badge catalog mutations (RLS enforces Owner-only).
export async function createBadge(input: {
  label: string;
  description: string;
  visual_variant: string;
  icon_key?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("public_badges").insert({
    label: input.label,
    description: input.description,
    visual_variant: input.visual_variant,
    icon_key: input.icon_key ?? null,
    created_by: auth.user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateBadge(
  id: string,
  patch: Partial<{
    label: string;
    description: string;
    visual_variant: string;
    icon_key: string | null;
    is_active: boolean;
  }>,
) {
  const { error } = await supabase.from("public_badges").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export const BADGE_VARIANTS: { value: string; label: string }[] = [
  { value: "default", label: "Neutre" },
  { value: "ember", label: "Ember (rouge)" },
  { value: "gold", label: "Or" },
  { value: "cyan", label: "Cyan" },
];
