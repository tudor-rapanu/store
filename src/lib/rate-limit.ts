import { headers } from "next/headers";
import { NextResponse } from "next/server";

type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter: number;
};

type UpstashPipelineResponse = Array<{
  result?: unknown;
  error?: string;
}>;

declare global {
  var rateLimitBuckets: Map<string, RateLimitBucket> | undefined;
}

const buckets = global.rateLimitBuckets ?? new Map<string, RateLimitBucket>();
global.rateLimitBuckets = buckets;

function getFirstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function getClientIdentifier(headersList: Headers) {
  return (
    getFirstHeaderValue(headersList.get("cf-connecting-ip")) ??
    getFirstHeaderValue(headersList.get("x-forwarded-for")) ??
    getFirstHeaderValue(headersList.get("x-real-ip")) ??
    "unknown"
  );
}

function cleanupExpiredBuckets(now: number) {
  if (buckets.size < 1000) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  return url && token ? { url, token } : null;
}

async function checkRedisRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): Promise<RateLimitResult | null> {
  const config = getUpstashConfig();

  if (!config) {
    return null;
  }

  const now = Date.now();
  const windowSeconds = Math.max(Math.ceil(windowMs / 1000), 1);

  try {
    const response = await fetch(`${config.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["SET", key, "0", "NX", "EX", windowSeconds],
        ["INCR", key],
        ["TTL", key],
      ]),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as UpstashPipelineResponse;
    const count = Number(data[1]?.result);
    const ttl = Number(data[2]?.result);

    if (!Number.isFinite(count)) {
      return null;
    }

    const resetAt = now + Math.max(Number.isFinite(ttl) ? ttl : windowSeconds, 1) * 1000;
    const retryAfter = Math.max(Math.ceil((resetAt - now) / 1000), 1);
    const remaining = Math.max(limit - count, 0);

    return {
      allowed: count <= limit,
      limit,
      remaining,
      resetAt,
      retryAfter,
    };
  } catch {
    return null;
  }
}

function checkMemoryRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const existingBucket = buckets.get(key);
  const bucket =
    existingBucket && existingBucket.resetAt > now
      ? existingBucket
      : { count: 0, resetAt: now + windowMs };

  bucket.count += 1;
  buckets.set(key, bucket);

  const retryAfter = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);
  const remaining = Math.max(limit - bucket.count, 0);

  return {
    allowed: bucket.count <= limit,
    limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfter,
  };
}

export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const key = `rate-limit:${options.keyPrefix}:${identifier}`;
  const redisResult = await checkRedisRateLimit(key, options);

  if (redisResult) {
    return redisResult;
  }

  return checkMemoryRateLimit(key, options);
}

export async function checkRequestRateLimit(
  request: Request,
  options: RateLimitOptions,
) {
  return checkRateLimit(getClientIdentifier(request.headers), options);
}

export async function checkServerActionRateLimit(options: RateLimitOptions) {
  return checkRateLimit(getClientIdentifier(await headers()), options);
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}
