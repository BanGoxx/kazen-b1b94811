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

// Fixed timezone so the absolute-date label is byte-identical on the server
// (UTC) and every client, regardless of the runtime's local timezone. This is
// what makes the pre-hydration deterministic render reproducible.
const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});

export function getNextEpisodeSignal(
  nextEpisode: MediaItem["nextEpisode"],
  // `null` = pre-hydration / not-yet-mounted: emit a deterministic label that
  // depends only on the (serialized) air date, never on the current time, so
  // the server render and the first client render are identical. Pass a real
  // timestamp after mount to get the accurate relative wording.
  now: number | null = Date.now(),
): NextEpisodeSignal | null {
  if (!nextEpisode || !nextEpisode.airDate) return null;
  const air = new Date(nextEpisode.airDate);
  if (Number.isNaN(air.getTime())) return null;

  const ep = nextEpisode.number;

  // Deterministic pre-hydration render: absolute date only (time-independent).
  if (now === null) {
    return {
      short: `Prochain ép. : ${dayFmt.format(air)}`,
      imminent: false,
      today: false,
      episodeNumber: ep,
    };
  }

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
