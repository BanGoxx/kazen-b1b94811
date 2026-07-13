import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bell, Check, CalendarRange, Settings2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { DigestPreview } from "@/components/digest/DigestPreview";
import { useRecap } from "@/lib/use-recap";
import { useNotifications } from "@/lib/use-notifications";
import { usePersonalizedDigest, useEmailPreferences } from "@/lib/use-digest";
import { currentWeekStart, formatWeekRange } from "@/lib/recap";

export const Route = createFileRoute("/_authenticated/recap")({
  head: () => ({
    meta: [
      { title: "Récap de la semaine — KAZEN" },
      {
        name: "description",
        content:
          "Votre récapitulatif hebdomadaire KAZEN : sélection personnalisée et activité de la semaine. Affichage dans l'application uniquement.",
      },
    ],
  }),
  component: RecapPage,
  errorComponent: () => (
    <AppShell>
      <div className="mx-auto max-w-2xl py-16 text-center text-sm text-muted-foreground">
        Impossible de charger le récap pour le moment.
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="mx-auto max-w-2xl py-16 text-center text-sm text-muted-foreground">
        Page introuvable.
      </div>
    </AppShell>
  ),
});

function RecapPage() {
  const { weekStart, read, isLoading: recapLoading, markRead, isMarking } =
    useRecap();
  const { data: prefs } = useEmailPreferences();
  const digest = usePersonalizedDigest(prefs);
  const { notifications } = useNotifications();

  const week = weekStart ?? currentWeekStart();

  // "This week" activity: count notifications that occurred during the current
  // ISO week. We show only a count + link to the feed — never re-list items,
  // to avoid duplicating the notification center.
  const weekCount = useMemo(() => {
    const start = new Date(`${week}T00:00:00Z`).getTime();
    const end = start + 7 * 24 * 3600_000;
    return notifications.filter((n) => {
      const t = new Date(n.occurredAt || n.createdAt).getTime();
      return t >= start && t < end;
    }).length;
  }, [notifications, week]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <CalendarRange className="h-6 w-6 text-primary" />
              Récap de la semaine
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatWeekRange(week)} · Affichage dans l'application uniquement.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/profil" hash="notifications">
              <Settings2 className="mr-1.5 h-4 w-4" />
              Préférences
            </Link>
          </Button>
        </header>

        {/* This week's activity summary — links to the feed, no duplication. */}
        <Link
          to="/notifications"
          className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {weekCount > 0
                ? `${weekCount} notification${weekCount > 1 ? "s" : ""} cette semaine`
                : "Aucune notification cette semaine"}
            </p>
            <p className="text-xs text-muted-foreground">
              Ouvrir le centre de notifications
            </p>
          </div>
        </Link>

        {/* Personalized selection (reuses the digest builder). */}
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/80">
            Votre sélection de la semaine
          </h2>
        </div>
        <DigestPreview
          model={digest.model}
          isLoading={digest.isLoading}
          providerFailed={digest.providerFailed}
          contextLabel="Récap hebdomadaire"
        />

        {/* Read state — deterministic per ISO week, no email path. */}
        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/40 p-4">
          <p className="text-sm text-muted-foreground">
            {read
              ? "Récap de cette semaine marqué comme lu."
              : "Marquez ce récap comme lu une fois consulté."}
          </p>
          <Button
            variant={read ? "outline" : "aurora"}
            size="sm"
            disabled={read || recapLoading || isMarking}
            onClick={() => markRead()}
          >
            <Check className="mr-1.5 h-4 w-4" />
            {read ? "Lu" : "Marquer comme lu"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
