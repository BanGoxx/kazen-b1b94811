// KAZEN — Shared AniList outbound queue (server-only).
//
// Single serial FIFO with 450 ms minimum spacing enforced across ALL server
// modules that hit https://graphql.anilist.co (fiches, list rails, home,
// canonicalization V2, admin jobs). Additional per-caller ceilings (e.g.
// V2's 30 req/min token bucket) can layer on top; they can only tighten
// this queue, never bypass it.
//
// This module owns the ONLY module-scope queue variable. `anilist.server.ts`
// and `import-canonical-v2.server.ts` both route through
// `withAniListSlot(fn)` so we cannot end up with two parallel budgets.

const MIN_SPACING_MS = 450;

let queue: Promise<unknown> = Promise.resolve();
let lastAt = 0;

// Overridable clock/sleep for tests. Never exposed as parameters to the
// public API — the browser cannot inject these.
let nowFn: () => number = () => Date.now();
let sleepFn: (ms: number) => Promise<void> = (ms) =>
  new Promise((r) => setTimeout(r, ms));

/**
 * Serialises `fn` behind the global AniList queue, enforcing >=450 ms between
 * successive network wakeups. Callers must not open their own fetch outside
 * this helper — that would create a parallel budget.
 */
export function withAniListSlot<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const elapsed = nowFn() - lastAt;
    if (elapsed < MIN_SPACING_MS) await sleepFn(MIN_SPACING_MS - elapsed);
    lastAt = nowFn();
    return fn();
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Test-only seam. Never call from production code paths. */
export const __testing = {
  reset(): void {
    queue = Promise.resolve();
    lastAt = 0;
    nowFn = () => Date.now();
    sleepFn = (ms) => new Promise((r) => setTimeout(r, ms));
  },
  setClock(fn: () => number): void {
    nowFn = fn;
  },
  setSleep(fn: (ms: number) => Promise<void>): void {
    sleepFn = fn;
  },
  getLastAt(): number {
    return lastAt;
  },
};
