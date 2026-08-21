/**
 * Sliding-window rate limiter with two backends:
 *
 *   - Memory:  globalThis Map. Single warm application instance. Resets on
 *              cold starts. Default; no env vars needed.
 *   - Upstash: Redis sorted set per key. Cross-instance accurate.
 *              Activated automatically when both
 *              UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 *              are set.
 *
 * Caller contract is the same regardless of backend: returns
 * RateLimitResult with allowed/remaining/retryAfterSeconds. The
 * function is async — both backends share the signature so we never
 * have to refactor call sites again when scaling decisions change.
 *
 * Single-warm-instance memory limiting is enough for the common
 * abuse pattern (bot hammering one endpoint from one IP). Redis is
 * what you want once the host starts spawning concurrent instances
 * across regions or when you need accurate per-org caps.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

interface Backend {
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
  name(): string;
}

// ── Memory backend ───────────────────────────────────────────────────

type Bucket = number[]; // timestamps in ms

const globalForBuckets = globalThis as unknown as {
  __shadowguardRateBuckets?: Map<string, Bucket>;
};
if (!globalForBuckets.__shadowguardRateBuckets) {
  globalForBuckets.__shadowguardRateBuckets = new Map();
}
const buckets = globalForBuckets.__shadowguardRateBuckets;

const memoryBackend: Backend = {
  name: () => "memory",
  async hit(key, limit, windowMs) {
    const now = Date.now();
    const cutoff = now - windowMs;
    let hits = buckets.get(key) ?? [];
    hits = hits.filter((t) => t > cutoff);

    if (hits.length >= limit) {
      const oldest = hits[0] ?? now;
      return {
        allowed: false,
        limit,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
      };
    }

    hits.push(now);
    buckets.set(key, hits);
    return {
      allowed: true,
      limit,
      remaining: limit - hits.length,
      retryAfterSeconds: 0,
    };
  },
};

// ── Upstash Redis backend ────────────────────────────────────────────
// Lazy import so the dep doesn't ship in the edge bundle when we're not
// using it. Pure ZSET sliding window; Upstash REST is HTTP, no socket
// management required.

let redisBackend: Backend | null = null;
let redisInitTried = false;

function buildRedisBackend(): Backend | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  // We capture a promise to the Redis instance so we don't import the
  // module at all when env vars aren't configured. Each call awaits it
  // (cheap after the first hit).
  const clientPromise = import("@upstash/redis").then(
    ({ Redis }) => new Redis({ url, token })
  );

  return {
    name: () => "upstash",
    async hit(key, limit, windowMs) {
      const redis = await clientPromise;
      const now = Date.now();
      const cutoff = now - windowMs;
      const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

      // Pipeline: drop stale entries, count current, add ours, set TTL.
      // ZADD must come AFTER zcard so we don't include the new entry
      // in the limit check.
      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(key, 0, cutoff);
      pipeline.zcard(key);
      const results = (await pipeline.exec()) as [number, number];
      const currentCount = results[1] ?? 0;

      if (currentCount >= limit) {
        // Find the oldest entry's score to compute retry-after.
        const oldest = (await redis.zrange(key, 0, 0, { withScores: true })) as
          | (string | number)[]
          | null;
        const oldestScore =
          oldest && oldest.length >= 2 ? Number(oldest[1]) : now;
        return {
          allowed: false,
          limit,
          remaining: 0,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((oldestScore + windowMs - now) / 1000)
          ),
        };
      }

      const writePipeline = redis.pipeline();
      writePipeline.zadd(key, { score: now, member });
      writePipeline.pexpire(key, windowMs);
      await writePipeline.exec();

      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - currentCount - 1),
        retryAfterSeconds: 0,
      };
    },
  };
}

function pickBackend(): Backend {
  if (!redisInitTried) {
    redisInitTried = true;
    redisBackend = buildRedisBackend();
  }
  return redisBackend ?? memoryBackend;
}

/**
 * Sliding-window rate limit check. Returns `{allowed, remaining,
 * retryAfterSeconds}`. Async because the Redis backend is HTTP.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  return pickBackend().hit(key, limit, windowMs);
}

/** Test-only: force re-evaluation of the backend choice. */
export function _resetBackendForTest(): void {
  redisInitTried = false;
  redisBackend = null;
}

/** Test-only: which backend is currently active. */
export function _activeBackendName(): string {
  return pickBackend().name();
}

export function clientIp(request: NextRequest | Request): string {
  const headers = (request as Request).headers;
  // Prefer Cloudflare's CF-Connecting-IP when present — it carries the
  // real client IP regardless of how many proxies are chained ahead of
  // the origin. Falls back to x-forwarded-for (common reverse proxies) and
  // x-real-ip (legacy) so this works whether or not the orange-cloud
  // proxy is enabled.
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export function rateLimited(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: "rate_limited",
      retry_after_seconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    }
  );
}
