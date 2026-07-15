import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const LOCALE_MAP = { fr: "fr-FR", en: "en-US" } as const;

/**
 * Compact "next episode" card for ongoing series/anime. Shows the upcoming
 * episode number, its air date, and a live countdown so a returning user
 * instantly knows what's next and exactly when.
 */
export function NextEpisodeCard({
  nextEpisode,
}: {
  nextEpisode: { number: number; airDate: string } | null;
}) {
  const { t, locale } = useI18n();
  const air = nextEpisode?.airDate ? new Date(nextEpisode.airDate) : null;
  const valid = air && !Number.isNaN(air.getTime());

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
      countdown = t.fiche.airedRecently;
    } else {
      const totalMin = Math.floor(diffMs / 60_000);
      const days = Math.floor(totalMin / 1440);
      const hours = Math.floor((totalMin % 1440) / 60);
      const mins = totalMin % 60;
      if (days >= 1) {
        countdown = t.fiche.inDaysHours
          .replace("{days}", String(days))
          .replace("{hours}", String(hours));
      } else if (hours >= 1) {
        countdown = t.fiche.inHoursMin
          .replace("{hours}", String(hours))
          .replace("{mins}", String(mins));
        imminent = true;
      } else {
        countdown = t.fiche.inMinutes.replace("{mins}", String(mins));
        imminent = true;
      }
    }
  }

  const dateLabel = new Intl.DateTimeFormat(LOCALE_MAP[locale], {
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
          {t.fiche.nextEpisode}
        </p>
        <p className="truncate text-sm font-semibold">
          {t.fiche.episodeFull} {nextEpisode.number}
          {countdown ? ` · ${countdown}` : ""}
        </p>
        <p className="truncate text-xs capitalize text-muted-foreground">{dateLabel}</p>
      </div>
    </div>
  );
}
