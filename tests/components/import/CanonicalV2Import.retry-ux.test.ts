// KAZEN — Phase G.6D non-regression: honest Retry UX.
//
// Static assertions on the panel source to guarantee:
//   - no button labelled "Réessayer" survives;
//   - refresh action is honestly labelled "Actualiser l'état";
//   - Skip stays available for failed items;
//   - Confirm gate depends on !failedCount;
//   - no client-side call to internal service_role RPCs (release_lock,
//     store_chunk, claim_chunk).
//
// These assertions target the *source* rather than a rendered tree so they
// hold without a DOM/SSR harness and cannot be silently regressed by a naive
// refactor that re-adds the misleading button.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "./CanonicalV2Import.tsx"),
  "utf8",
);

describe("Phase G.6D — Canonical V2 panel retry UX", () => {
  it("does not expose a 'Réessayer' button anymore", () => {
    // The only allowed occurrences of the word Réessayer would be in a comment,
    // and even then we prefer none. Enforce full absence in JSX button labels.
    expect(SRC).not.toMatch(/>\s*Réessayer[^<]*</);
    expect(SRC).not.toMatch(/handleRetry/);
  });

  it("labels the polling/refresh action honestly", () => {
    expect(SRC).toMatch(/Actualiser l'état/);
    expect(SRC).toMatch(/handleRefreshState/);
  });

  it("keeps 'Ignorer les échecs' as the functional exit for failed items", () => {
    expect(SRC).toMatch(/Ignorer les \{failedCount\} échec\(s\)/);
    expect(SRC).toMatch(/handleSkipFailed/);
  });

  it("blocks confirm while failedCount > 0 (canConfirm depends on !failedCount)", () => {
    expect(SRC).toMatch(/canConfirm\s*=\s*Boolean\([^)]*!failedCount[^)]*\)/);
  });

  it("surfaces a public terminal message for unrecoverable errors", () => {
    expect(SRC).toMatch(/n'ont pas pu être récupérés automatiquement/);
  });

  it("never imports or references worker-only service_role RPCs from the client", () => {
    expect(SRC).not.toMatch(/release_lock/);
    expect(SRC).not.toMatch(/store_chunk/);
    expect(SRC).not.toMatch(/claim_chunk/);
    // The public server-fn helpers are the only allowed boundary.
    expect(SRC).toMatch(/import-canonical-v2\.functions/);
  });
});
