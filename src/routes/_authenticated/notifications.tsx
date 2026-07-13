import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  Megaphone,
  Newspaper,
  Play,
  Settings2,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/lib/use-notifications";
import {
  relativeTimeFr,
  type AppNotification,
  type NotificationType,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — KAZEN" },
      {
        name: "description",
        content:
          "Vos rappels de sorties, articles liés et annonces KAZEN, regroupés au même endroit.",
      },
    ],
  }),
  component: NotificationsPage,
  errorComponent: () => (
    <AppShell>
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Impossible de charger vos notifications pour le moment.
        </p>
      </div>
    </AppShell>
  ),
});

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  new_episode: Play,
  upcoming_release: CalendarClock,
  related_article: Newspaper,
  personalized_recommendation: Sparkles,
  shared_list_request: Users,
  shared_list_request_accepted: Users,
  shared_list_request_declined: Users,
  system_notice: Megaphone,
};

function Row({
  n,
  onDismiss,
  onRead,
}: {
  n: AppNotification;
  onDismiss: (id: string) => void;
  onRead: (id: string) => void;
}) {
  const Icon = TYPE_ICON[n.type] ?? Bell;
  const unread = !n.readAt;
  return (
    <li
      className={cn(
        "group relative flex gap-4 rounded-xl border border-border p-4 transition-colors hover:bg-muted/40",
        unread && "border-primary/30 bg-primary/5",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          unread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </span>
      <Link
        to={n.destinationUrl}
        onClick={() => onRead(n.id)}
        className="min-w-0 flex-1"
      >
        <p className="flex items-center gap-2 font-medium leading-tight">
          <span>{n.title}</span>
          {unread && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Non lu" />
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
        <p className="mt-1.5 text-xs text-muted-foreground/80">
          {relativeTimeFr(n.occurredAt)}
        </p>
      </Link>
      <button
        type="button"
        onClick={() => onDismiss(n.id)}
        aria-label="Ignorer la notification"
        className="self-start rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    snoozed,
    isLoading,
    hasMore,
    isLoadingMore,
    loadMore,
    markRead,
    markAll,
    dismiss,
  } = useNotifications();

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Bell className="h-6 w-6 text-primary" />
              Notifications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {snoozed
                ? "Mise en veille active — le badge est masqué."
                : unreadCount > 0
                  ? `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}.`
                  : "Vous êtes à jour."}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm">
              <Link to="/recap">
                <CalendarRange className="mr-1.5 h-4 w-4" />
                Récap
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/profil" hash="notifications">
                <Settings2 className="mr-1.5 h-4 w-4" />
                Préférences
              </Link>
            </Button>
          </div>
        </header>

        {unreadCount > 0 && (
          <div className="mb-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => markAll()}>
              <CheckCheck className="mr-1.5 h-4 w-4" />
              Tout marquer comme lu
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/40" aria-hidden />
            <p className="font-medium">Aucune notification pour le moment</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Ajoutez des titres à votre liste : vos rappels de sorties et les
              articles liés apparaîtront ici automatiquement.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link to="/">Explorer le catalogue</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="space-y-2.5">
              {notifications.map((n) => (
                <Row key={n.id} n={n} onDismiss={dismiss} onRead={markRead} />
              ))}
            </ul>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadMore()}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Chargement…" : "Charger plus"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
