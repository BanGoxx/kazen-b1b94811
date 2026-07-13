// Centralized, PURE tracking business logic for KAZEN personal lists.
//
// Every tracking surface (fiche panel, "Ma liste" editor, and any future
// tracking control) must route status/progress/date/rewatch changes through
// these helpers so the same rules apply consistently. Nothing here touches the
// network, React, or the DB — it only transforms plain values, which keeps the
// rules testable and impossible to drift between components.

import type { ListPatch } from "./list.functions";
import type { MediaType, WatchStatus } from "./media-types";

/** Snapshot of the current tracking state for an entry (or defaults). */
export interface TrackingState {
  status: WatchStatus | null;
  progress: number | null;
  startedAt: string | null;
  completedAt: string | null;
  rewatchCount: number;
  isRewatching: boolean;
}

/**
 * Current local calendar date normalized to a stable ISO string at UTC
 * midnight, matching how manual date inputs are already persisted
 * (`${yyyy-mm-dd}T00:00:00.000Z`). Building it from the LOCAL year/month/day
 * avoids the timezone drift you'd get from `new Date().toISOString()` (which
 * could roll to the previous/next day for users west/east of UTC).
 */
export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T00:00:00.000Z`;
}

/**
 * Reliable maximum progress for a title, or `null` when unknown.
 * - Movies are never treated as episodic (they use watched/completed status).
 * - Episodic titles use the count for THIS title/season as loaded on the
 *   fiche (never a whole-franchise total).
 * - A missing/zero/negative count means "unknown" — no cap is invented.
 */
export function effectiveMax(
  mediaType: MediaType,
  episodesCount: number | null | undefined,
): number | null {
  if (mediaType === "movie") return null;
  if (episodesCount != null && episodesCount > 0) return Math.floor(episodesCount);
  return null;
}

/** Clamp a progress value into `0..max` (integer). `null` stays `null`. */
export function clampProgress(
  value: number | null | undefined,
  max: number | null,
): number | null {
  if (value == null || Number.isNaN(value)) return null;
  let v = Math.max(0, Math.floor(value));
  if (max != null) v = Math.min(v, max);
  return v;
}

/**
 * True when a saved progress exceeds a newly reported, reliable maximum.
 * Used to surface a non-destructive reconciliation warning — the stored value
 * is NEVER reduced automatically.
 */
export function needsReconciliation(
  progress: number | null | undefined,
  max: number | null,
): boolean {
  return max != null && progress != null && progress > max;
}

/**
 * True when episodic progress has reached (or passed) the final episode but the
 * title isn't marked finished yet — the trigger for the optional
 * "Marquer comme terminé" affordance.
 */
export function atFinalEpisode(state: TrackingState, max: number | null): boolean {
  return (
    max != null &&
    state.progress != null &&
    state.progress >= max &&
    state.status !== "termine"
  );
}

/**
 * Apply KAZEN tracking rules to a raw patch, given the previous state and the
 * reliable maximum. Returns an augmented patch. Only fields the user actually
 * changed (plus auto-derived dates/progress) are included.
 *
 * Rules enforced here (see product spec):
 *  - Progress is clamped to `0..max` when a reliable max exists.
 *  - `started_at` is set to today ONLY when empty AND a first-start event fires
 *    (status -> "en_cours", or progress goes from 0/null to > 0).
 *  - Explicit status -> "termine" sets `completed_at` (only if empty) and fills
 *    progress up to `max` when safe (never reduces a higher value).
 *  - Existing/imported/manual dates are never overwritten or erased here.
 */
export function applyTrackingRules(
  prev: TrackingState,
  max: number | null,
  patch: ListPatch,
): ListPatch {
  const out: ListPatch = { ...patch };

  // Clamp any incoming progress against the reliable max.
  if ("progress" in out) {
    out.progress = clampProgress(out.progress ?? null, max);
  }

  const today = todayIsoDate();
  const prevProgress = prev.progress ?? 0;
  const nextProgress = "progress" in out ? out.progress ?? 0 : prevProgress;

  // --- Start date ---
  const startingByStatus =
    "status" in out && out.status === "en_cours" && prev.status !== "en_cours";
  const startingByProgress =
    "progress" in out && prevProgress <= 0 && nextProgress > 0;
  if (
    (startingByStatus || startingByProgress) &&
    !prev.startedAt &&
    !out.started_at
  ) {
    out.started_at = today;
  }

  // --- Completion (only on EXPLICIT status change to "termine") ---
  if ("status" in out && out.status === "termine") {
    if (!prev.completedAt && !out.completed_at) out.completed_at = today;
    // Fill progress to the known total when safe (never reduce a higher value).
    if (max != null) {
      const cur = "progress" in out ? out.progress ?? 0 : prevProgress;
      if (cur < max) out.progress = max;
    }
  }

  return out;
}

/**
 * Patch for an explicit "Marquer comme terminé" confirmation at the final
 * episode: set status to finished. Completion date + progress-fill are handled
 * by {@link applyTrackingRules}. Kept separate so the intent is explicit.
 */
export function completePatch(): ListPatch {
  return { status: "termine" };
}

/**
 * Patch for an explicit "Recommencer" (rewatch) action:
 *  - increments `rewatch_count` exactly once;
 *  - marks `is_rewatching`;
 *  - resets progress to 0 (KAZEN convention);
 *  - preserves the historical `completed_at` and the original `started_at`.
 * Callers must guard against duplicate submissions (disable while pending).
 */
export function rewatchPatch(prev: TrackingState): ListPatch {
  return {
    rewatch_count: (prev.rewatchCount ?? 0) + 1,
    is_rewatching: true,
    progress: 0,
  };
}

/** Build a TrackingState from a (possibly missing) list entry-like object. */
export function toTrackingState(entry: {
  status?: WatchStatus | null;
  progress?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  rewatchCount?: number | null;
  isRewatching?: boolean | null;
} | null | undefined): TrackingState {
  return {
    status: entry?.status ?? null,
    progress: entry?.progress ?? null,
    startedAt: entry?.startedAt ?? null,
    completedAt: entry?.completedAt ?? null,
    rewatchCount: entry?.rewatchCount ?? 0,
    isRewatching: entry?.isRewatching ?? false,
  };
}
