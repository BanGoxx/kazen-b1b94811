import { Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  Megaphone,
  Newspaper,
  Play,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/use-notifications";
import {
  relativeTimeFr,
  type AppNotification,
  type NotificationType,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  new_episode: Play,
  upcoming_release: CalendarClock,
  related_article: Newspaper,
  personalized_recommendation: Sparkles,
  shared_list_request: Users,
  shared_list_request_accepted: Users,
  shared_list_request_declined: Users,
  chat_message: MessageCircle,
  system_notice: Megaphone,
};

function NotificationRow({
  n,
  onNavigate,
  onDismiss,
  onRead,
}: {
  n: AppNotification;
  onNavigate: () => void;
  onDismiss: (id: string) => void;
  onRead: (id: string) => void;
}) {
  const Icon = TYPE_ICON[n.type] ?? Bell;
  const unread = !n.readAt;
  return (
    <li
      className={cn(
        "group relative flex gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/60",
        unread && "bg-primary/5",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          unread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <Link
        to={n.destinationUrl}
        onClick={() => {
          onRead(n.id);
          onNavigate();
        }}
        className="min-w-0 flex-1"
      >
        <p className="flex items-center gap-2 text-sm font-medium leading-tight">
          <span className="truncate">{n.title}</span>
          {unread && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Non lu" />
          )}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
        <p className="mt-1 text-[11px] text-muted-foreground/80">
          {relativeTimeFr(n.occurredAt)}
        </p>
      </Link>
      <button
        type="button"
        onClick={() => onDismiss(n.id)}
        aria-label="Ignorer la notification"
        className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground/60 opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

export function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount, markRead, markAll, dismiss, isLoading } =
    useNotifications();

  if (!user) return null;

  const preview = notifications.slice(0, 8);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} non lues`
              : "Notifications"
          }
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAll()}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Tout marquer comme lu
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : preview.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm font-medium">Aucune notification</p>
            <p className="text-xs text-muted-foreground">
              Vos rappels de sorties et articles liés apparaîtront ici.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[24rem]">
            <ul className="space-y-1 p-1.5">
              {preview.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onNavigate={() => {}}
                  onDismiss={dismiss}
                  onRead={markRead}
                />
              ))}
            </ul>
          </ScrollArea>
        )}

        <div className="border-t border-border px-4 py-2.5 text-center">
          <Link
            to="/notifications"
            className="text-xs font-medium text-primary hover:underline"
          >
            Voir toutes les notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
