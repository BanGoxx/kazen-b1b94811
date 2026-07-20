// Server-only unit tests for the Canonicalization V2 normalizer.
// Runs under Node — never imports any client code. No network, no DB.

import { describe, it, expect } from "vitest";
import {
  __internal,
  buildCanonicalSnapshot,
  safeHttps,
  pickReleaseDate,
  pickScore,
  pickTitle,
  isRetryable,
  ProviderError,
} from "./import-canonical-v2.server";

describe("pickScore — DB contract 0..100, no rescaling", () => {
  it.each([
    [0, 0],
    [1, 1],
    [50, 50],
    [87, 87],
    [100, 100],
  ])("preserves valid score %s → %s", (input, expected) => {
    expect(pickScore({ id: 1, averageScore: input })).toBe(expected);
  });

  it("rounds finite decimals to nearest integer", () => {
    expect(pickScore({ id: 1, averageScore: 87.4 })).toBe(87);
    expect(pickScore({ id: 1, averageScore: 87.6 })).toBe(88);
  });

  it("returns null for null/undefined/missing", () => {
    expect(pickScore({ id: 1, averageScore: null })).toBeNull();
    expect(pickScore({ id: 1 })).toBeNull();
  });

  it("rejects negative, >100, NaN, non-numeric", () => {
    expect(pickScore({ id: 1, averageScore: -1 })).toBeNull();
    expect(pickScore({ id: 1, averageScore: 101 })).toBeNull();
    expect(pickScore({ id: 1, averageScore: NaN })).toBeNull();
    expect(pickScore({ id: 1, averageScore: Infinity })).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(pickScore({ id: 1, averageScore: "87" as any })).toBeNull();
  });
});

describe("pickReleaseDate — full valid calendar date only, no invention", () => {
  it("keeps a complete valid date", () => {
    expect(pickReleaseDate({ id: 1, startDate: { year: 2024, month: 4, day: 5 } })).toBe(
      "2024-04-05",
    );
  });

  it("rejects a year-only date (no 01-01 invention)", () => {
    expect(pickReleaseDate({ id: 1, startDate: { year: 2024 } })).toBeNull();
  });

  it("rejects a year+month partial date", () => {
    expect(pickReleaseDate({ id: 1, startDate: { year: 2024, month: 4 } })).toBeNull();
  });

  it("accepts a real Feb 29 in a leap year", () => {
    expect(pickReleaseDate({ id: 1, startDate: { year: 2024, month: 2, day: 29 } })).toBe(
      "2024-02-29",
    );
  });

  it("rejects Feb 29 in a non-leap year", () => {
    expect(pickReleaseDate({ id: 1, startDate: { year: 2023, month: 2, day: 29 } })).toBeNull();
  });

  it("rejects month 13", () => {
    expect(pickReleaseDate({ id: 1, startDate: { year: 2024, month: 13, day: 1 } })).toBeNull();
  });

  it("rejects day 32", () => {
    expect(pickReleaseDate({ id: 1, startDate: { year: 2024, month: 1, day: 32 } })).toBeNull();
  });

  it("rejects null startDate", () => {
    expect(pickReleaseDate({ id: 1, startDate: null })).toBeNull();
    expect(pickReleaseDate({ id: 1 })).toBeNull();
  });
});

describe("safeHttps — HTTPS + AniList CDN only", () => {
  it("accepts https AniList CDN URLs", () => {
    expect(safeHttps("https://s4.anilist.co/file/anilistcdn/media/anime/cover.jpg")).toBe(
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover.jpg",
    );
  });
  it("rejects http", () => {
    expect(safeHttps("http://s4.anilist.co/x.jpg")).toBeNull();
  });
  it("rejects other hosts", () => {
    expect(safeHttps("https://evil.example/x.jpg")).toBeNull();
  });
  it("rejects garbage", () => {
    expect(safeHttps("not a url")).toBeNull();
    expect(safeHttps(null)).toBeNull();
    expect(safeHttps(undefined)).toBeNull();
  });
});

describe("pickTitle — never empty, trims, caps length", () => {
  it("prefers english, falls back romaji then native", () => {
    expect(pickTitle({ id: 1, title: { english: "E", romaji: "R", native: "N" } })).toEqual({
      title: "E",
      original: "N",
    });
    expect(pickTitle({ id: 1, title: { romaji: "R", native: "N" } })).toEqual({
      title: "R",
      original: "N",
    });
    expect(pickTitle({ id: 1, title: { native: "N" } })).toEqual({ title: "N", original: null });
  });
  it("returns null when nothing usable", () => {
    expect(pickTitle({ id: 1, title: { english: "  ", romaji: null, native: null } })).toBeNull();
    expect(pickTitle({ id: 1 })).toBeNull();
  });
});

describe("buildCanonicalSnapshot", () => {
  it("returns null when id is missing or non-positive", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildCanonicalSnapshot({ id: 0 } as any)).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildCanonicalSnapshot({ id: -1 } as any)).toBeNull();
  });

  it("builds a full snapshot with score preserved 0..100", () => {
    const snap = buildCanonicalSnapshot({
      id: 21,
      title: { english: "One Piece", romaji: "One Piece", native: "ワンピース" },
      coverImage: { extraLarge: "https://s4.anilist.co/file/x.jpg" },
      bannerImage: "https://s4.anilist.co/file/b.jpg",
      genres: ["Action", "Adventure"],
      averageScore: 87,
      startDate: { year: 1999, month: 10, day: 20 },
    });
    expect(snap).toMatchObject({
      source: "anilist",
      external_id: "21",
      media_key: "anilist:21",
      media_type: "anime",
      title: "One Piece",
      score: 87,
      release_date: "1999-10-20",
      poster_url: "https://s4.anilist.co/file/x.jpg",
      backdrop_url: "https://s4.anilist.co/file/b.jpg",
      genres: ["Action", "Adventure"],
    });
  });

  it("caps genres at 24 entries and filters out empties", () => {
    const many = Array.from({ length: 40 }, (_, i) => `g${i}`);
    const snap = buildCanonicalSnapshot({
      id: 1,
      title: { english: "T" },
      genres: [...many, "", "  "] as string[],
    });
    expect(snap?.genres.length).toBe(24);
  });
});

describe("isRetryable classification", () => {
  it("classifies retryable codes", () => {
    expect(isRetryable("provider_rate_limited")).toBe(true);
    expect(isRetryable("provider_timeout")).toBe(true);
    expect(isRetryable("provider_unavailable")).toBe(true);
  });
  it("classifies terminal codes as non-retryable", () => {
    expect(isRetryable("provider_not_found")).toBe(false);
    expect(isRetryable("provider_id_mismatch")).toBe(false);
    expect(isRetryable("invalid_canonical_payload")).toBe(false);
    expect(isRetryable("random")).toBe(false);
  });
});

describe("ProviderError shape", () => {
  it("captures code + optional retryAfterMs", () => {
    const e = new ProviderError("provider_rate_limited", "429", 5000);
    expect(e.code).toBe("provider_rate_limited");
    expect(e.retryAfterMs).toBe(5000);
    expect(e.message).toBe("429");
  });
});

describe("withRetry — retryable then terminal", () => {
  it("retries retryable errors up to MAX_ATTEMPTS then rethrows", async () => {
    let calls = 0;
    const deps = __internal.makeDefaultDeps();
    deps.sleep = async () => {};
    await expect(
      __internal.withRetry(async () => {
        calls += 1;
        throw new ProviderError("provider_timeout");
      }, deps),
    ).rejects.toThrow();
    expect(calls).toBe(__internal.MAX_ATTEMPTS);
  });

  it("throws terminal errors immediately without retry", async () => {
    let calls = 0;
    const deps = __internal.makeDefaultDeps();
    deps.sleep = async () => {};
    await expect(
      __internal.withRetry(async () => {
        calls += 1;
        throw new ProviderError("provider_not_found");
      }, deps),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("stops on first success", async () => {
    let calls = 0;
    const deps = __internal.makeDefaultDeps();
    deps.sleep = async () => {};
    const out = await __internal.withRetry(async () => {
      calls += 1;
      if (calls < 3) throw new ProviderError("provider_unavailable");
      return "ok";
    }, deps);
    expect(out).toBe("ok");
    expect(calls).toBe(3);
  });
});

describe("waitForToken — sliding window", () => {
  it("blocks when limit reached within window", async () => {
    const deps = __internal.makeDefaultDeps();
    let clock = 1000;
    deps.now = () => clock;
    const sleeps: number[] = [];
    deps.sleep = async (ms) => {
      sleeps.push(ms);
      clock += ms;
    };
    deps.tokenBucketLimit = 3;
    deps.tokenBucketWindowMs = 1000;
    for (let i = 0; i < 3; i += 1) await __internal.waitForToken(deps);
    // 4th call should sleep until oldest falls off the window.
    await __internal.waitForToken(deps);
    expect(sleeps.length).toBeGreaterThan(0);
    expect(sleeps[0]).toBeGreaterThan(0);
  });
});

describe("fetchAniListBatch — chunking + partial responses (mock fetch)", () => {
  it("returns empty map for no ids without any fetch", async () => {
    const deps = __internal.makeDefaultDeps();
    let calls = 0;
    deps.fetch = async () => {
      calls += 1;
      return new Response("{}");
    };
    const { fetchAniListBatch } = await import("./import-canonical-v2.server");
    const out = await fetchAniListBatch([], { deps });
    expect(out.size).toBe(0);
    expect(calls).toBe(0);
  });

  it("rejects >50 ids at once with terminal error", async () => {
    const deps = __internal.makeDefaultDeps();
    deps.fetch = async () => new Response("{}");
    const { fetchAniListBatch } = await import("./import-canonical-v2.server");
    const ids = Array.from({ length: 51 }, (_, i) => i + 1);
    await expect(fetchAniListBatch(ids, { deps })).rejects.toMatchObject({
      code: "invalid_canonical_payload",
    });
  });

  it("emits partial response as explicit missing ids (not thrown)", async () => {
    const deps = __internal.makeDefaultDeps();
    deps.fetch = async () =>
      new Response(
        JSON.stringify({ data: { Page: { media: [{ id: 1, title: { english: "A" } }] } } }),
        { headers: { "content-type": "application/json" } },
      );
    const { fetchAniListBatch } = await import("./import-canonical-v2.server");
    const out = await fetchAniListBatch([1, 2, 3], { deps });
    expect(out.size).toBe(1);
    expect(out.has(1)).toBe(true);
    expect(out.has(2)).toBe(false);
  });

  it("classifies 429 as retryable with Retry-After", async () => {
    const deps = __internal.makeDefaultDeps();
    deps.fetch = async () =>
      new Response("rate limited", { status: 429, headers: { "retry-after": "7" } });
    const { fetchAniListBatch } = await import("./import-canonical-v2.server");
    await expect(fetchAniListBatch([1], { deps })).rejects.toMatchObject({
      code: "provider_rate_limited",
      retryAfterMs: 7000,
    });
  });

  it("classifies 5xx as retryable provider_unavailable", async () => {
    const deps = __internal.makeDefaultDeps();
    deps.fetch = async () => new Response("boom", { status: 502 });
    const { fetchAniListBatch } = await import("./import-canonical-v2.server");
    await expect(fetchAniListBatch([1], { deps })).rejects.toMatchObject({
      code: "provider_unavailable",
    });
  });

  it("uses cache for repeat ids without a second fetch", async () => {
    const deps = __internal.makeDefaultDeps();
    let calls = 0;
    deps.fetch = async () => {
      calls += 1;
      return new Response(
        JSON.stringify({ data: { Page: { media: [{ id: 1, title: { english: "A" } }] } } }),
        { headers: { "content-type": "application/json" } },
      );
    };
    const { fetchAniListBatch } = await import("./import-canonical-v2.server");
    await fetchAniListBatch([1], { deps });
    await fetchAniListBatch([1], { deps });
    expect(calls).toBe(1);
  });
});

describe("chunking bound — at most ceil(N/50) fetches for N=500", () => {
  it("makes 10 batched fetches for 500 unique ids", async () => {
    const deps = __internal.makeDefaultDeps();
    let calls = 0;
    deps.fetch = async (_url, init) => {
      calls += 1;
      const body = JSON.parse((init as RequestInit).body as string) as {
        variables: { ids: number[] };
      };
      const media = body.variables.ids.map((id) => ({
        id,
        title: { english: `T${id}` },
      }));
      return new Response(JSON.stringify({ data: { Page: { media } } }), {
        headers: { "content-type": "application/json" },
      });
    };
    const { fetchAniListBatch } = await import("./import-canonical-v2.server");
    let total = 0;
    for (let i = 0; i < 10; i += 1) {
      const ids = Array.from({ length: 50 }, (_, j) => i * 50 + j + 1);
      const out = await fetchAniListBatch(ids, { deps });
      total += out.size;
    }
    expect(calls).toBe(10);
    expect(total).toBe(500);
  });
});
