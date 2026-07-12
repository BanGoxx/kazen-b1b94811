import { CalendarClock } from "lucide-react";

/**
 * Compact "next episode" card for ongoing series/anime. Shows the upcoming
 * episode number, its air date, and a friendly countdown so a returning user
 * instantly knows what's next and when. Renders nothing without a next episode.
 */
export function NextEpisodeCard({
  nextEpisode,
}: {
  nextEpisode: { number: number; airDate: string } | null;
}) {
  if (!nextEpisode?.airDate) return null;
  const air = new Date(nextEpisode.airDate);
  if (Number.isNaN(air.getTime())) return null;

  const now = new Date();
  const msPerDay = 86_400_000;
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startAir = new Date(air.getFullYear(), air.getMonth(), air.getDate()).getTime();
  const days = Math.round((startAir - startToday) / msPerDay);

  let countdown: string;
  if (days < 0) countdown = "Déjà diffusé";
  else if (days === 0) countdown = "Aujourd'hui";
  else if (days === 1) countdown = "Demain";
  else countdown = `Dans ${days} jours`;

  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(air);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <CalendarClock className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Prochain épisode
        </p>
        <p className="truncate text-sm font-semibold">
          Épisode {nextEpisode.number} · {countdown}
        </p>
        <p className="truncate text-xs capitalize text-muted-foreground">{dateLabel}</p>
      </div>
    </div>
  );
}
