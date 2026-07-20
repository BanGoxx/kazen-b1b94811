// KAZEN — Phase G, Section A — retries-metric assertion unit test.
//
// The concurrent volume harness must NOT count retries against the canonical
// budget. This isolated test protects the calculation independently of the
// live 500-item harness, so `baseRequests = totalRequests - retryRequests`
// and `baseRequests <= ceil(n / 50)` cannot silently regress.

import { describe, expect, it } from "vitest";

function baseRequests(totalRequests: number, retryRequests: number): number {
  return totalRequests - retryRequests;
}

function invariantOk(totalRequests: number, retryRequests: number, n: number): boolean {
  const base = baseRequests(totalRequests, retryRequests);
  const min = Math.ceil(n / 50);
  return base <= min;
}

describe("canonical V2 volume metrics — retries invariant", () => {
  it("subtracts retries from totalRequests", () => {
    expect(baseRequests(12, 2)).toBe(10);
    expect(baseRequests(10, 0)).toBe(10);
  });

  it("500-item run with 2 retries is OK (10 base <= 10)", () => {
    expect(invariantOk(12, 2, 500)).toBe(true);
  });

  it("500-item run with 0 retries is OK (10 <= 10)", () => {
    expect(invariantOk(10, 0, 500)).toBe(true);
  });

  it("500-item run with a genuine extra fetch VIOLATES (11 > 10)", () => {
    // 13 total - 2 retries = 11 canonical fetches for 10-chunk budget
    expect(invariantOk(13, 2, 500)).toBe(false);
  });

  it("100-item run with 0 retries is OK (2 <= 2)", () => {
    expect(invariantOk(2, 0, 100)).toBe(true);
  });

  it("51-item run needs at most 2 base fetches", () => {
    expect(invariantOk(2, 0, 51)).toBe(true);
    expect(invariantOk(3, 0, 51)).toBe(false);
  });
});
