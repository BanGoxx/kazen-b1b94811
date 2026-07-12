import type { MediaItem } from "./media-types";

/**
 * Shared "next episode" formatting used across Découverte (cards) and fiches.
 *
 * Single source of truth so the signal reads identically everywhere:
 *  - "Diffusion aujourd'hui"
 *  - "Ép. 4 dans 2 j"
 *  - "Ép. 4 dans 5 h"
 *  - "Prochain ép. : 18 juil."
 *
 * Returns null when there is no valid upcoming episode, so every consumer can
 * hide gracefully without duplicating date parsing / validation logic.
 */
export interface NextEpisodeSignal {
  /** Ultra-compact label for cards/badges. */
  short: string;
  /** Whether it airs within the next ~24h (used for emphasis). */
  imminent: boolean;
  /** Whether it airs today. */
  today: boolean;
  episodeNumber: number;
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

export function getNextEpisodeSignal(
  nextEpisode: MediaItem["nextEpisode"],
  now: number = Date.now(),
): NextEpisodeSignal | null {
  if (!nextEpisode || !nextEpisode.airDate) return null;
  const air = new Date(nextEpisode.airDate);
  if (Number.isNaN(air.getTime())) return null;

  const diffMs = air.getTime() - now;
  const ep = nextEpisode.number;
  const epLabel = Number.isFinite(ep) && ep > 0 ? `Ép. ${ep}` : "Épisode";

  // Already aired (within our lookahead window) — don't advertise as upcoming.
  if (diffMs <= 0) return null;

  const totalMin = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);

  const airDay = new Date(air);
  const today = new Date(now);
  const isToday =
    airDay.getFullYear() === today.getFullYear() &&
    airDay.getMonth() === today.getMonth() &&
    airDay.getDate() === today.getDate();

  let short: string;
  if (isToday) {
    short = "Diffusion aujourd'hui";
  } else if (days >= 7) {
    short = `Prochain ép. : ${dayFmt.format(air)}`;
  } else if (days >= 1) {
    short = `${epLabel} dans ${days} j`;
  } else {
    short = `${epLabel} dans ${Math.max(1, hours)} h`;
  }

  return {
    short,
    imminent: days < 1,
    today: isToday,
    episodeNumber: ep,
  };
}
