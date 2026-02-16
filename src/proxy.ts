import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isDevBypassEnabled } from "@/lib/dev-bypass";

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
];

// Paths accessible to authenticated users regardless of access status
const PENDING_PATHS = [
  "/redeem",
  "/api/access-codes/redeem",
  "/api/payment/checkout",
  "/payment",
  "/api/user",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isPendingPath(pathname: string): boolean {
  return PENDING_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
