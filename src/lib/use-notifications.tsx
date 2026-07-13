// KAZEN Internal Notification Center — client data hooks.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  createSystemNotice,
  dismissNotification,
  getMyNotificationPreferences,
  getMyUnreadCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  reconcileMyNotifications,
  updateMyNotificationPreferences,
} from "@/lib/notifications.functions";
import type { NotificationPreferences } from "@/lib/notifications";

const KEY = ["notifications"] as const;

export function useNotifications() {
  const { user } = useAuth();
  const enabled = !!user;
  const qc = useQueryClient();

  const listFn = useServerFn(listMyNotifications);
  const countFn = useServerFn(getMyUnreadCount);
  const reconcileFn = useServerFn(reconcileMyNotifications);
  const markReadFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);
  const dismissFn = useServerFn(dismissNotification);

  const listQuery = useQuery({
    queryKey: [...KEY, "list", user?.id],
    queryFn: () => listFn(),
    enabled,
    staleTime: 60_000,
  });

  const countQuery = useQuery({
    queryKey: [...KEY, "count", user?.id],
    queryFn: () => countFn(),
    enabled,
    staleTime: 60_000,
  });

  // Best-effort background reconciliation once per session mount, then refresh.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    reconcileFn()
      .then(() => {
        if (cancelled) return;
        qc.invalidateQueries({ queryKey: [...KEY, "list", user?.id] });
        qc.invalidateQueries({ queryKey: [...KEY, "count", user?.id] });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, user?.id]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: [...KEY, "list", user?.id] });
    qc.invalidateQueries({ queryKey: [...KEY, "count", user?.id] });
  }, [qc, user?.id]);

  const markRead = useMutation({
    mutationFn: (id: string) => markReadFn({ data: { id } }),
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: invalidate,
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => dismissFn({ data: { id } }),
    onSuccess: invalidate,
  });

  return {
    notifications: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    unreadCount: countQuery.data?.count ?? 0,
    markRead: (id: string) => markRead.mutate(id),
    markAll: () => markAll.mutate(),
    dismiss: (id: string) => dismiss.mutate(id),
    refetch: invalidate,
  };
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const getFn = useServerFn(getMyNotificationPreferences);
  const setFn = useServerFn(updateMyNotificationPreferences);

  const query = useQuery({
    queryKey: [...KEY, "prefs", user?.id],
    queryFn: () => getFn(),
    enabled: !!user,
    staleTime: 300_000,
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) => setFn({ data: patch }),
    onSuccess: (data) => {
      qc.setQueryData([...KEY, "prefs", user?.id], data);
    },
  });

  return {
    prefs: query.data,
    isLoading: query.isLoading,
    update: (patch: Partial<NotificationPreferences>) => mutation.mutate(patch),
    isSaving: mutation.isPending,
  };
}

export function useCreateSystemNotice() {
  const fn = useServerFn(createSystemNotice);
  return useMutation({
    mutationFn: (input: { title: string; message: string; destinationUrl?: string }) =>
      fn({ data: input }),
  });
}
