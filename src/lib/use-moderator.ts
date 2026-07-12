import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { myModeratorStatus } from "@/lib/moderation.functions";

/**
 * Client hook: may the signed-in user access the moderation surface?
 * During the beta this is Owner-only, backed by the SECURITY DEFINER
 * `can_moderate_now` check server-side (currently `has_role(uid,'owner')`).
 * The UI gate is convenience only — real enforcement lives in RLS + the DB
 * functions. Restoring moderator/admin access later is a one-line change to
 * `can_moderate_now` in the database; no call sites need editing.
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
