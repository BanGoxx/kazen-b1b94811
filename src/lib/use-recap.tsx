import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "./auth";
import { getMyRecapState, markRecapRead } from "./recap.functions";
import type { RecapState } from "./recap";

const KEY = ["weekly-recap"] as const;

/**
 * Client hook for the in-app weekly recap read state. Content is built by the
 * digest hooks; this only tracks whether the current week has been seen.
 */
export function useRecap() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const getFn = useServerFn(getMyRecapState);
  const markFn = useServerFn(markRecapRead);

  const query = useQuery<RecapState>({
    queryKey: [...KEY, user?.id],
    queryFn: () => getFn(),
    enabled: !!user,
    staleTime: 300_000,
  });

  const mutation = useMutation({
    mutationFn: () => markFn(),
    onSuccess: (data) => {
      qc.setQueryData([...KEY, user?.id], data);
    },
  });

  return {
    weekStart: query.data?.weekStart ?? null,
    read: query.data?.read ?? false,
    isLoading: query.isLoading,
    markRead: () => mutation.mutate(),
    isMarking: mutation.isPending,
  };
}
