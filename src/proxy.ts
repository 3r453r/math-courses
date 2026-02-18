import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isDevBypassEnabled } from "@/lib/dev-bypass";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";


function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const EDGE_API_RATE_LIMIT = {
  namespace: "edge:api",
  windowMs: readPositiveIntEnv("EDGE_RATE_LIMIT_WINDOW_MS", 60_000),
  maxRequests: readPositiveIntEnv("EDGE_API_RATE_LIMIT_MAX", 120),
} as const;

const EDGE_SENSITIVE_RATE_LIMIT = {
  namespace: "edge:sensitive",
  windowMs: readPositiveIntEnv("EDGE_RATE_LIMIT_WINDOW_MS", 60_000),
  maxRequests: readPositiveIntEnv("EDGE_SENSITIVE_RATE_LIMIT_MAX", 30),
} as const;

const SENSITIVE_PATH_PREFIXES = [
  "/api/access-codes/redeem",
  "/api/auth",
  "/api/test-key",
  "/api/payment/checkout",
];

function isSensitivePath(pathname: string): boolean {
  return SENSITIVE_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Public paths that don't require any authentication
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/gallery",
  "/api/gallery",
  "/pricing",
  "/shared",
  "/api/shared",
  "/api/payment/webhook",
  "/preview",
  "/api/preview",
  "/api/site-config",
  "/api/version",
  "/terms",
];

// Paths accessible to authenticated users regardless of access status
const PENDING_PATHS = [
  "/redeem",
  "/api/access-codes/redeem",
  "/api/payment/checkout",
  "/payment",
  "/api/user",
  "/terms/accept",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isPendingPath(pathname: string): boolean {
  return PENDING_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const strictConfig = isSensitivePath(pathname) ? EDGE_SENSITIVE_RATE_LIMIT : EDGE_API_RATE_LIMIT;
    const ddosGuard = checkRateLimit({ request, config: strictConfig });
    if (!ddosGuard.allowed) {
      console.warn(JSON.stringify({
        event: "edge_rate_limit_exceeded",
        route: pathname,
        key: ddosGuard.key,
        limit: ddosGuard.limit,
        retryAfterSeconds: ddosGuard.retryAfterSeconds,
        timestamp: new Date().toISOString(),
      }));
      return rateLimitExceededResponse(ddosGuard);
    }
  }

  // Dev bypass: auto-authenticate when AUTH_DEV_BYPASS=true
  if (isDevBypassEnabled()) {
    return NextResponse.next();
  }

  // Allow public paths through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for session token (JWT strategy uses this cookie)
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken) {
    // API routes return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Pages redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Allow pending-user paths through (they have a session but may not be active)
  if (isPendingPath(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
