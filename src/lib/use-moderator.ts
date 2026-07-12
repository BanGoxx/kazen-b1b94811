import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { myModeratorStatus } from "@/lib/moderation.functions";

/**
 * Client hook: is the signed-in user a moderator/admin/owner?
 * Backed by the SECURITY DEFINER `is_moderator` check server-side; the UI gate
 * is convenience only — real enforcement lives in RLS + the DB functions.
 */
export function useIsModerator(): boolean {
  const { user } = useAuth();
  const check = useServerFn(myModeratorStatus);
  const { data } = useQuery({
    queryKey: ["is-moderator", user?.id],
    queryFn: () => check(),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });
  return Boolean(data?.isModerator);
}
