import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, clientIp } from "../rate-limit";

// Reset the in-memory bucket store between tests so one test's keys
// don't bleed into another's.
beforeEach(() => {
  const g = globalThis as unknown as {
    __shadowguardRateBuckets?: Map<string, number[]>;
  };
  g.__shadowguardRateBuckets?.clear();
});

describe("rateLimit (memory backend)", () => {
  it("allows up to limit requests in the window", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await rateLimit("test:burst", 5, 60_000);
      expect(r.allowed).toBe(true);
    }
    expect((await rateLimit("test:burst", 5, 60_000)).allowed).toBe(false);
  });

  it("returns shrinking remaining count", async () => {
    expect((await rateLimit("test:remaining", 3, 60_000)).remaining).toBe(2);
    expect((await rateLimit("test:remaining", 3, 60_000)).remaining).toBe(1);
    expect((await rateLimit("test:remaining", 3, 60_000)).remaining).toBe(0);
  });

  it("isolates buckets by key", async () => {
    await rateLimit("a", 1, 60_000);
    expect((await rateLimit("a", 1, 60_000)).allowed).toBe(false);
    // Different key, fresh bucket.
    expect((await rateLimit("b", 1, 60_000)).allowed).toBe(true);
  });

  it("returns retryAfterSeconds >= 1 when blocked", async () => {
    await rateLimit("test:retry", 1, 60_000);
    const blocked = await rateLimit("test:retry", 1, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("recovers after the window slides past", async () => {
    // Burn the bucket with a window that's already in the past.
    const past = Date.now() - 10_000;
    const buckets = (globalThis as unknown as {
      __shadowguardRateBuckets: Map<string, number[]>;
    }).__shadowguardRateBuckets;
    buckets.set("test:slide", [past, past, past]);

    // Window of 5s — all three timestamps are stale, bucket is fresh.
    const r = await rateLimit("test:slide", 3, 5_000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });
});

describe("backend selection", () => {
  // We can't test the real Redis backend without a live Upstash
  // instance. What we CAN test is the selection logic — that absent
  // env vars keeps us on the memory backend, and that setting both
  // env vars switches the active backend name.

  it("uses memory when Upstash env vars are absent", async () => {
    const { _resetBackendForTest, _activeBackendName } = await import("../rate-limit");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    _resetBackendForTest();
    expect(_activeBackendName()).toBe("memory");
  });

  it("uses upstash when both env vars are set", async () => {
    const { _resetBackendForTest, _activeBackendName } = await import("../rate-limit");
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    _resetBackendForTest();
    expect(_activeBackendName()).toBe("upstash");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    _resetBackendForTest();
  });
});

describe("clientIp", () => {
  function makeReq(headers: Record<string, string>): Request {
    return new Request("https://example.com/test", { headers });
  }

  it("prefers cf-connecting-ip", () => {
    const req = makeReq({
      "cf-connecting-ip": "1.2.3.4",
      "x-forwarded-for": "5.6.7.8, 9.10.11.12",
      "x-real-ip": "13.14.15.16",
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-forwarded-for first hop when no cf header", () => {
    const req = makeReq({
      "x-forwarded-for": "5.6.7.8, 9.10.11.12",
    });
    expect(clientIp(req)).toBe("5.6.7.8");
  });

  it("falls back to x-real-ip when no other proxy headers", () => {
    const req = makeReq({ "x-real-ip": "13.14.15.16" });
    expect(clientIp(req)).toBe("13.14.15.16");
  });

  it("returns 'unknown' when no headers present", () => {
    const req = makeReq({});
    expect(clientIp(req)).toBe("unknown");
  });

  it("trims whitespace from extracted IPs", () => {
    const req = makeReq({ "x-forwarded-for": "  1.2.3.4  , 5.6.7.8" });
    expect(clientIp(req)).toBe("1.2.3.4");
  });
});
