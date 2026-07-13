import {
  CalendarClock,
  Megaphone,
  Newspaper,
  Play,
  Sparkles,
  Users,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNotificationPreferences } from "@/lib/use-notifications";
import {
  CATEGORY_PREF_KEY,
  NOTIFICATION_CATEGORY_META,
  type NotificationCategory,
} from "@/lib/notifications";

const ICONS: Record<NotificationCategory, typeof Play> = {
  new_episode: Play,
  upcoming_release: CalendarClock,
  related_article: Newspaper,
  recommendation: Sparkles,
  shared_list: Users,
  system_notice: Megaphone,
};

// Categories with a live event source in Phase 1. Others are shown but marked
// "bientôt" so members understand the toggle is reserved for a future release.
const ACTIVE: Record<NotificationCategory, boolean> = {
  new_episode: false,
  upcoming_release: true,
  related_article: true,
  recommendation: false,
  shared_list: false,
  system_notice: true,
};

const ORDER: NotificationCategory[] = [
  "upcoming_release",
  "related_article",
  "system_notice",
  "new_episode",
  "recommendation",
  "shared_list",
];

export function NotificationPreferences() {
  const { prefs, isLoading, update, isSaving } = useNotificationPreferences();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Notifications dans l'application</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez les alertes que vous souhaitez recevoir dans KAZEN. Indépendant
          de vos préférences e-mail.
        </p>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {ORDER.map((cat) => {
          const meta = NOTIFICATION_CATEGORY_META[cat];
          const Icon = ICONS[cat];
          const prefKey = CATEGORY_PREF_KEY[cat];
          const checked = prefs ? prefs[prefKey] : true;
          const active = ACTIVE[cat];
          return (
            <li key={cat} className="flex items-start gap-3 p-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {meta.label}
                  {!active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Bientôt
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {meta.description}
                </p>
              </div>
              <Switch
                checked={checked}
                disabled={isLoading || isSaving}
                onCheckedChange={(v) => update({ [prefKey]: v })}
                aria-label={meta.label}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
