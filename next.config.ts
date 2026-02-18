import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://github.com https://discord.com https://checkout.stripe.com",
  "upgrade-insecure-requests",
];

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspDirectives.join("; "),
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(self), payment=()",
  },
];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_TEST_MODE ? ".next-test" : ".next",
  env: {
    NEXT_PUBLIC_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA || new Date().toISOString(),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Public pages — CDN-cacheable (no auth cookie)
      {
        source: "/(login|gallery|pricing|shared/:path*|preview/:path*|terms)",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
          },
        ],
      },
      // Authenticated app pages — private, revalidate every time
      {
        source:
          "/((?!_next/static|_next/image|api/|login|gallery|pricing|shared/|preview/|sw\\.js|manifest\\.json).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
