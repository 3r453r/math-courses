import { NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function normalizeOrigin(value: string | null): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(request: Request): Set<string> {
  const allowedOrigins = new Set<string>();
  const candidates = [
    process.env.APP_BASE_URLS,
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.AUTH_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    new URL(request.url).origin,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const entries = candidate.split(",");
    for (const entry of entries) {
      const origin = normalizeOrigin(entry.trim());
      if (origin) {
        allowedOrigins.add(origin);
      }
    }
  }

  return allowedOrigins;
}

export function validateCsrfRequest(request: Request): NextResponse | null {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return null;
  }

  const allowedOrigins = getAllowedOrigins(request);
  const originHeader = normalizeOrigin(request.headers.get("origin"));

  if (originHeader) {
    if (allowedOrigins.has(originHeader)) {
      return null;
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const refererHeader = request.headers.get("referer");
  const refererOrigin = normalizeOrigin(refererHeader);

  if (refererOrigin && allowedOrigins.has(refererOrigin)) {
    return null;
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
