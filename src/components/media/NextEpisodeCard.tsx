import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";

/**
 * Compact "next episode" card for ongoing series/anime. Shows the upcoming
 * episode number, its air date, and a live countdown (days / hours / minutes)
 * so a returning user instantly knows what's next and exactly when. Renders
 * nothing without a valid next episode, so the fiche never shows empty UI.
 */
export function NextEpisodeCard({
  nextEpisode,
}: {
  nextEpisode: { number: number; airDate: string } | null;
}) {
  const air = nextEpisode?.airDate ? new Date(nextEpisode.airDate) : null;
  const valid = air && !Number.isNaN(air.getTime());

  // Start at `null` so SSR and the first client render are identical (no
  // countdown, which depends on the current time). After mount we compute the
  // live countdown and tick every 30s without heavy re-renders.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!valid) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [valid]);

  if (!valid || !nextEpisode) return null;

  let countdown: string | null = null;
  let imminent = false;
  if (now !== null) {
    const diffMs = air.getTime() - now;
    if (diffMs <= 0) {
      countdown = "Diffusé récemment";
    } else {
      const totalMin = Math.floor(diffMs / 60_000);
      const days = Math.floor(totalMin / 1440);
      const hours = Math.floor((totalMin % 1440) / 60);
      const mins = totalMin % 60;
      if (days >= 1) {
        countdown = `Dans ${days} j ${hours} h`;
      } else if (hours >= 1) {
        countdown = `Dans ${hours} h ${mins} min`;
        imminent = true;
      } else {
        countdown = `Dans ${mins} min`;
        imminent = true;
      }
    }
  }

  // Fixed timezone keeps this label byte-identical on the server (UTC) and the
  // client, so hydration never mismatches on the date/hour.
  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(air);

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 ${
        imminent
          ? "border-primary/50 bg-primary/10"
          : "border-primary/25 bg-primary/5"
      }`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <CalendarClock className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Prochain épisode
        </p>
        <p className="truncate text-sm font-semibold">
          Épisode {nextEpisode.number}
          {countdown ? ` · ${countdown}` : ""}
        </p>
        <p className="truncate text-xs capitalize text-muted-foreground">{dateLabel}</p>
      </div>
    </div>
  );
}
