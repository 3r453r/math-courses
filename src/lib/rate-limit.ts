import { NextResponse } from "next/server";

type RateLimitBucket = {
  count: number;
  windowStartMs: number;
};

export type RateLimitConfig = {
  namespace: string;
  windowMs: number;
  maxRequests: number;
};

export type RateLimitCheckResult = {
  allowed: boolean;
  key: string;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAtMs: number;
};

const globalStore = globalThis as typeof globalThis & {
  __rateLimitStore?: Map<string, RateLimitBucket>;
};

const store = globalStore.__rateLimitStore ?? new Map<string, RateLimitBucket>();
globalStore.__rateLimitStore = store;

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  return null;
}

function getClientKey(request: Request, userId?: string): string {
  if (userId) return `user:${userId}`;
  return `ip:${getClientIp(request) ?? "unknown"}`;
}

export function checkRateLimit(params: {
  request: Request;
  config: RateLimitConfig;
  userId?: string;
}): RateLimitCheckResult {
  // Skip rate limiting in E2E test mode — all tests share a single dev bypass user
  if (process.env.NEXT_TEST_MODE === "1") {
    return {
      allowed: true,
      key: "test-bypass",
      limit: params.config.maxRequests,
      remaining: params.config.maxRequests,
      retryAfterSeconds: 0,
      resetAtMs: Date.now() + params.config.windowMs,
    };
  }

  const now = Date.now();
  const clientKey = getClientKey(params.request, params.userId);
  const compositeKey = `${params.config.namespace}:${clientKey}`;

  const existing = store.get(compositeKey);
  const windowStartMs = existing && now - existing.windowStartMs < params.config.windowMs
    ? existing.windowStartMs
    : now;

  const count = existing && windowStartMs === existing.windowStartMs ? existing.count : 0;

  if (count >= params.config.maxRequests) {
    const resetAtMs = windowStartMs + params.config.windowMs;
    return {
      allowed: false,
      key: compositeKey,
      limit: params.config.maxRequests,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
      resetAtMs,
    };
  }

  const nextCount = count + 1;
  store.set(compositeKey, { count: nextCount, windowStartMs });

  const remaining = Math.max(0, params.config.maxRequests - nextCount);
  return {
    allowed: true,
    key: compositeKey,
    limit: params.config.maxRequests,
    remaining,
    retryAfterSeconds: 0,
    resetAtMs: windowStartMs + params.config.windowMs,
  };
}

export function rateLimitExceededResponse(result: RateLimitCheckResult) {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": result.retryAfterSeconds.toString(),
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": result.resetAtMs.toString(),
      },
    }
  );
}

export function enforceRateLimit(params: {
  request: Request;
  config: RateLimitConfig;
  userId?: string;
  route: string;
}) {
  const result = checkRateLimit({
    request: params.request,
    config: params.config,
    userId: params.userId,
  });

  if (result.allowed) return null;

  console.warn(
    JSON.stringify({
      event: "rate_limit_exceeded",
      route: params.route,
      key: result.key,
      limit: result.limit,
      retryAfterSeconds: result.retryAfterSeconds,
      resetAtMs: result.resetAtMs,
      timestamp: new Date().toISOString(),
    })
  );

  return rateLimitExceededResponse(result);
}

export function __resetRateLimitStore() {
  store.clear();
}
