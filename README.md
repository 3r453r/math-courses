This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## AI logging hardening

- File-based debug dumps are **disabled by default** and only written when `AI_DEBUG_DUMPS=true`.
- Persisted AI logs redact/hash long prompt sections (including context documents and long user-provided text).
- Sensitive prompt/raw payload fields in `AiGenerationLog` are retained temporarily and then redacted by TTL (`AI_LOG_SENSITIVE_TTL_HOURS`, default: 24).
- Admin log detail views may hide raw payloads when access is restricted or after retention redaction.

## API Rate Limiting

High-risk mutation and generation endpoints use a shared in-memory fixed-window limiter from `src/lib/rate-limit.ts`.

Current defaults:

- `POST /api/access-codes/redeem`: 5 requests / 60s
- `POST /api/test-key`: 10 requests / 60s
- `POST /api/chat`: 30 requests / 60s
- `POST /api/generate/{course|lesson|quiz|diagnostic|trivia}`: 10 requests / 60s
- `POST /api/courses`, `POST /api/courses/clone`, `POST /api/courses/import`: 10 requests / 60s
- `POST`/`DELETE /api/courses/[courseId]/share`: 20 requests / 60s

When exceeded, routes return `429 Too Many Requests` and include `Retry-After` plus `X-RateLimit-*` headers.

### Tuning guidance

1. Edit the per-route constants defined in each route file (search for `*_RATE_LIMIT`).
2. Keep sensitive endpoints (code redemption, import/clone) stricter than read endpoints.
3. If deploying multiple app instances, move limiter state to a shared store (e.g., Redis) for globally consistent enforcement.

### Quick-win DDoS guard

A coarse IP-based edge limiter runs in `src/proxy.ts` for all `/api/*` traffic (with stricter limits for sensitive routes like auth/redeem/test-key). This is a fast win for noisy clients and low-effort abuse, but it is **not** a full DDoS solution. For real attack resistance, use an upstream WAF/CDN rate limiter and bot protection.

Optional env tuning:

- `EDGE_RATE_LIMIT_WINDOW_MS` (default `60000`)
- `EDGE_API_RATE_LIMIT_MAX` (default `120`)
- `EDGE_SENSITIVE_RATE_LIMIT_MAX` (default `30`)
