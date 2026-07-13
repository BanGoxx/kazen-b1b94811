import {
  BellOff,
  CalendarClock,
  Clock,
  Megaphone,
  Newspaper,
  Play,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

      <DeliveryControls
        quietMode={prefs?.quiet_mode ?? false}
        snoozeUntil={prefs?.snooze_until ?? null}
        disabled={isLoading || isSaving}
        onUpdate={update}
      />
    </section>
  );
}

const SNOOZE_PRESETS: { label: string; hours: number }[] = [
  { label: "1 heure", hours: 1 },
  { label: "24 heures", hours: 24 },
  { label: "7 jours", hours: 24 * 7 },
];

function DeliveryControls({
  quietMode,
  snoozeUntil,
  disabled,
  onUpdate,
}: {
  quietMode: boolean;
  snoozeUntil: string | null;
  disabled: boolean;
  onUpdate: (patch: {
    quiet_mode?: boolean;
    snooze_until?: string | null;
  }) => void;
}) {
  const snoozeActive =
    !!snoozeUntil && new Date(snoozeUntil).getTime() > Date.now();

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold">Contrôles de diffusion</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Suspendez temporairement les alertes sans changer vos préférences.
        </p>
      </div>

      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <BellOff className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Mode silencieux</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Aucune nouvelle notification n'est générée. Les alertes existantes
            restent visibles.
          </p>
        </div>
        <Switch
          checked={quietMode}
          disabled={disabled}
          onCheckedChange={(v) => onUpdate({ quiet_mode: v })}
          aria-label="Mode silencieux"
        />
      </div>

      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Clock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Masquer le badge (veille)</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {snoozeActive
              ? `Actif jusqu'au ${new Date(snoozeUntil!).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}.`
              : "Le compteur non lu reste masqué pendant la durée choisie."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SNOOZE_PRESETS.map((p) => (
              <Button
                key={p.hours}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  onUpdate({
                    snooze_until: new Date(
                      Date.now() + p.hours * 3600_000,
                    ).toISOString(),
                  })
                }
              >
                {p.label}
              </Button>
            ))}
            {snoozeActive && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onUpdate({ snooze_until: null })}
              >
                Annuler
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
