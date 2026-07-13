// KAZEN internal weekly recap — pure, deterministic helpers.
//
// The weekly recap is an IN-APP surface only. It never sends, schedules, or
// fetches email. It reuses the digest builder for content and adds a small
// "this week" summary derived from notifications. Read state is persisted
// per ISO week so the recap can be marked as seen without duplicating the
// notification feed.

/**
 * Returns the Monday (UTC) of the week containing `now`, as an ISO date
 * string (YYYY-MM-DD). Deterministic and timezone-stable by using UTC.
 */
export function currentWeekStart(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Human-friendly French label for a week starting on `weekStart` (Mon–Sun). */
export function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

export interface RecapState {
  /** ISO date of the current week's Monday. */
  weekStart: string;
  /** Whether the member has marked this week's recap as read. */
  read: boolean;
}
