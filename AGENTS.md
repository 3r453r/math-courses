# CLAUDE.md

> **Sync notice:** This file is mirrored in `AGENTS.md`. Any update to one MUST be copied to the other to keep them identical.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered learning platform built with Next.js 16. Users provide a topic and preferences, and Claude generates structured courses with lessons organized as a directed acyclic graph (DAG) of prerequisites — not a flat sequence. Lessons can be studied in parallel when they share the same prerequisites. Supports any STEM subject (math, physics, CS, etc.) — prompts are topic-agnostic.

## Commands

```bash
pnpm install          # Install deps (auto-runs prisma generate via postinstall)
pnpm dev              # Dev server on localhost:3000
pnpm build            # Production build
pnpm lint             # ESLint
npx prisma migrate dev --name <name>  # Create a new migration
npx prisma generate   # Regenerate Prisma client after schema changes
npx prisma studio     # Browse database in GUI
```

```bash
pnpm test             # Unit tests (Vitest)
pnpm test:integration # Integration tests (Vitest, separate config)
pnpm test:e2e         # E2E tests (Playwright)
pnpm test:all         # All of the above
```

## Architecture

**Monorepo (single package):** Next.js App Router with API routes, SQLite via Prisma + libsql adapter (supports both local `file:` and remote Turso `libsql://` URLs), Vercel AI SDK with multi-provider support (Anthropic, OpenAI, Google).

### Key Directories

- `src/app/api/` — Server-side API routes (course CRUD, AI generation, chat streaming)
- `src/lib/ai/` — AI client config, prompt templates, Zod schemas for structured AI output
- `src/lib/ai/schemas/` — Zod schemas: `courseSchema`, `lessonSchema`, `lessonWithQuizSchema`, `quizSchema`, `diagnosticSchema`, `completionSummarySchema`, `triviaSchema`
- `src/lib/ai/prompts/` — Prompt builders: `courseStructure`, `quizGeneration`, `completionSummary`, `triviaGeneration`, `voiceInterpretation`, `languageInstruction`, `vizRegeneration`
- `src/lib/ai/generationLogger.ts` — AI generation audit logging to `AiGenerationLog` table (outcome, duration, repair layers, wrapper type)
- `src/lib/ai/generationLogRetention.ts` — Retention policy and sensitive data expiration for generation logs
- `src/lib/ai/logSanitizer.ts` — Redact sensitive data from AI prompts/outputs before storage
- `src/lib/content/` — Content utilities: `safeEval.ts` (mathjs-based expression evaluator), `parseLessonContent.ts` (parse/normalize lesson content JSON; handles schema-drift in older AI-generated courses, malformed sections, missing fields), `vizValidation.ts` (validate and auto-repair visualization specs)
- `src/lib/quiz/` — Quiz scoring algorithm (≥80% advance, ≥50% supplement, <50% regenerate)
- `src/stores/appStore.ts` — Zustand store persisted to localStorage (API key, model selection, UI state)
- `src/components/ui/` — shadcn/ui components (New York style, Radix UI primitives)
- `src/components/chat/` — AI tutor chat sidebar (ChatPanel, ChatMessage, ChatInput)
- `src/components/scratchpad/` — Per-lesson scratchpad with LaTeX slash-commands
- `src/components/lesson/` — Lesson content renderer, section renderers, MathMarkdown, `RegenerateVizModal` (user feedback + optional screenshot upload for AI-powered viz regeneration)
- `src/lib/auth.ts` — Auth.js v5 configuration (OAuth providers, JWT sessions, Credentials dev bypass)
- `src/lib/auth-utils.ts` — auth helpers: `getAuthUser()`, `getAuthUserAnyStatus()`, CSRF-aware `getAuthUserFromRequest(request)` / `getAuthUserAnyStatusFromRequest(request)`, `requireAdmin()`, `requireOwner()`, CSRF-aware `requireAdminFromRequest(request)` / `requireOwnerFromRequest(request)`, `verifyCourseOwnership()`, `verifyLessonOwnership()`
- `src/lib/csrf.ts` — reusable CSRF guard (`Origin` + `Referer` fallback) for cookie-authenticated mutation requests
- `src/lib/stripe.ts` — Stripe client singleton for payment processing
- `src/components/admin/` — Admin panel components (AccessCodeManager, UserManager, GalleryManager, GenerationLogManager)
- `src/components/gallery/` — Gallery components (GalleryCard, StarRating, GalleryFilters)
- `src/components/landing/` — Landing page sections (HeroSection, HowItWorksSection, FeaturesSection, FeaturedCoursesSection, LandingFooter)
- `src/lib/crypto.ts` — AES-256-GCM encryption for server-side API key storage
- `src/lib/export/` — Export utilities: `courseData.ts` (shared data layer), `toMarkdown.ts`, `toJson.ts`
- `src/components/export/` — ExportDialog (Markdown/JSON/Print), ShareDialog (share link CRUD)
- `src/app/shared/[shareToken]/` — Public read-only course viewer (no auth required)
- `src/app/courses/[courseId]/print/` — Print-optimized page for browser Print-to-PDF
- `src/hooks/` — Custom hooks: `useApiHeaders`, `useNotebook`, `useScratchpad`, `useSpeechToText`, `useMobile`, `useLocalScratchpad`, `useInstallPrompt`, `useVersionCheck`
- `src/i18n/` — i18next configuration + locale files (`en`, `pl`) with 22 namespaces
- `src/components/notebook/` — Per-course notebook (NotebookPanel, NotebookPageList, NotebookPageNav)
- `src/lib/speech/` — Voice input: `speechManager`, `languageMap`, `voiceKeywords` (math keyword → LaTeX expansion)
- `src/lib/themes.ts` — Color theme definitions (neutral, ocean, sage, amber)
- `src/lib/rate-limit.ts` — In-memory fixed-window rate limiter (`checkRateLimit`, `enforceRateLimit`, `rateLimitExceededResponse`); user-ID or IP-based keys, per-namespace windows
- `src/lib/notifications.ts` — Browser Notification API wrapper (`requestNotificationPermission`, `sendNotification`)
- `src/lib/detectInAppBrowser.ts` — Detect in-app browsers (Facebook, Instagram, Twitter/X, etc.) and generate open-in-browser URLs
- `src/lib/subjects.ts` — Academic subject taxonomy (65+ subjects), `parseSubjects`/`serializeSubjects` for legacy and JSON array formats
- `src/lib/course/dagLayers.ts` — BFS topological sort for DAG layer computation (`computeDagLayers`)
- `src/components/generation/` — AI generation UI (GeneratingSpinner with messages, TriviaSlideshow for fun facts during generation)
- `src/components/preview/` — Gallery course preview (PreviewBanner, LockedDAGView, PreviewLessonView, PreviewQuizView, PreviewQuizCTA)
- `src/components/progress/` — Progress tracking (ProgressOverview, CourseProgressCard, ScoreBar, ScoreTimeline, WeakTopicsSummary)
- `prisma/schema.prisma` — Database schema (User, Account, Session, VerificationToken, Course, Lesson, CourseEdge, Quiz, QuizAttempt, DiagnosticQuiz, DiagnosticAttempt, Note, ChatMessage, CourseShare, AccessCode, AccessCodeRedemption, CourseRating, CourseCompletionSummary, Payment, AiGenerationLog, SiteConfig)

### AI Generation Flow

1. `POST /api/generate/course` — AI generates course structure (lessons + DAG edges) + a pedagogical context document (`contextDoc`) using `courseStructureSchema`
2. `POST /api/generate/lesson` — Two sequential `generateObject` calls: first generates lesson content (`lessonContentSchema`), then generates quiz (`quizSchema`) with the lesson content as context. The course `contextDoc` is injected into the lesson prompt. On regeneration with weak topics, quiz questions are weighted 50%+ toward weak areas.
3. `POST /api/generate/quiz` — Standalone quiz generation (fallback/regenerate-only). Also receives `lessonContent` and `contextDoc` when available.
4. `POST /api/generate/diagnostic` — Generates pre-course diagnostic quiz. Idempotent (returns existing if ready).
5. `POST /api/generate/trivia` — Generates trivia facts for a course (shown during generation spinner). Layer 0 & 1 repair only.
6. `POST /api/generate/visualization` — Regenerates a single visualization section in-place. Accepts `lessonId`, `courseId`, `sectionIndex`, optional `userFeedback` (text) and `screenshotBase64` (multimodal). Injects surrounding lesson sections + course `contextDoc` for context. Validates output with `validateAndRepairVisualizations`, patches `contentJson` in DB. Rate-limited to 20 req/60s per user. Mock mode supported.
7. `POST /api/chat` — Streaming AI tutor chat using `streamText` + `toTextStreamResponse()`. Client uses `TextStreamChatTransport` from AI SDK v6.
8. `POST /api/voice/interpret` — Voice transcript to LaTeX/math interpretation via `generateText` (non-streaming).
9. **Multi-provider AI**: `MODEL_REGISTRY` in `src/lib/ai/client.ts` supports 3 providers (Anthropic, OpenAI, Google) with 9 models. Users store per-provider API keys. `getProviderForModel()` selects the right SDK client. Two model tiers: primary (generation) and chat — user-configurable
10. **Schema repair pipeline** (`src/lib/ai/repairSchema.ts`, `src/lib/ai/client.ts`): Three-layer recovery for malformed AI output:
    - Layer 0: `experimental_repairText` in `generateObject` — unwraps Anthropic `{"parameter":...}` wrapping via `unwrapParameter()`, runs `coerceToSchema` (type coercion, enum fuzzy-match, unknown field stripping)
    - Layer 1: Direct `tryCoerceAndValidate` on raw `NoObjectGeneratedError.text` — also uses `unwrapParameter()` for consistent unwrapping
    - Layer 2: AI repack — cheapest available model re-serializes the content to match the schema
    - **`unwrapParameter()`** handles both wrapping formats: `{"parameter": {...}}` (object) and `{"parameter": "{\"title\":...}"}` (stringified JSON). Returns `wrapperType: "object" | "string" | "string-repaired" | null` for logging
    - **Critical**: Anthropic `jsonTool` mode sometimes returns array/object fields as **JSON-encoded strings** (e.g., `"sections":"[{...}]"` instead of `"sections":[{...}]`). `coerceToSchema` handles this by attempting `JSON.parse()` on string values when the schema expects an Array or Object. Without this, arrays silently default to `[]` and all generated content is lost.
    - **`AiGenerationLog`** table stores `wrapperType` column (`"object"` | `"string"` | `"string-repaired"` | null) for querying which wrapper format was encountered. Populated from both Layer 0 (`RepairTracker`) and Layer 1 (`recordLayer1`)
11. **Mock AI model**: `model === "mock"` bypasses all AI calls and returns hardcoded data from `src/lib/ai/mockData.ts`. NOT in `MODEL_REGISTRY` — each `/api/generate/*` route checks for it explicitly. Includes course structure (3 lessons), lesson content, quizzes, diagnostics, trivia, and completion summary. Select via Setup page dropdown or pass `"model": "mock"` in request body. Use the `/mock-testing` skill for detailed testing workflow. New AI-dependent endpoints should also check `if (body.model === "mock")` early and return mock data from `mockData.ts`.

### Content Rendering

- KaTeX for math (`$...$` inline, `$$...$$` display) via remark-math + rehype-katex
- mathjs for safe expression evaluation (function plots, vector fields, parametric surfaces)
- reagraph for prerequisite graph visualization

### Routes

- `/login` — Landing page (hero, features, featured courses, sign-in) with auth redirect to `/` for logged-in users
- `/` — Dashboard with course list (requires auth + API key)
- `/setup` — API key, model configuration, account info
- `/courses/new` — Course creation wizard
- `/courses/[courseId]` — Course overview with dependency graph
- `/courses/[courseId]/lessons/[lessonId]` — Lesson viewer with scratchpad and AI chat panels (mutually exclusive)
- `/courses/[courseId]/lessons/[lessonId]/quiz` — Lesson quiz
- `/courses/[courseId]/diagnostic` — Pre-course diagnostic quiz
- `/courses/[courseId]/completion` — Course completion summary
- `/courses/[courseId]/print` — Print-optimized full-course page (browser Print-to-PDF)
- `/progress` — Cross-course progress overview
- `/shared/[shareToken]` — Public read-only course viewer (no auth required)
- `/preview/[shareToken]` — Gallery course preview with locked DAG, preview lesson, and quiz CTA (no auth required)
- `/redeem` — Access code redemption (pending users)
- `/admin` — Admin panel: access codes, users, gallery management (admin only)
- `/gallery` — Public course gallery with search, filters, ratings, clone
- `/pricing` — Pricing/landing page with Stripe checkout
- `/payment/success` — Post-payment confirmation
- `/payment/cancel` — Payment cancelled page

## Tech Stack

Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Prisma 7 (SQLite/libsql), Auth.js v5 (next-auth@beta), Zustand 5, Zod 4, Vercel AI SDK (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `ai`), Stripe, KaTeX, mathjs, Three.js, Mafs, i18next, react-i18next, next-themes, shadcn/ui, reagraph

## Git / Branch Policy

- **NEVER switch branches or create feature branches locally** unless the user explicitly says "create a branch" or "use a feature branch". This is critical — multiple Claude Code agents work in this repo simultaneously, and switching the local checkout causes conflicts for all of them. "Commit, push and create a PR" does NOT mean "create a feature branch" — commit on `main`, push to `main`, and create a PR from `main` if needed.
- **Commit directly to `main`** and push to `main`. This is the default for all work.
- **Skills/tools that create branches**: If a skill (like `commit-push-pr`) tries to create a feature branch, override that behavior — stay on `main`. The branch policy in this file takes precedence over skill defaults.
- Cloud Claude Code instances with their own worktrees are exempt from this policy.

## Key Patterns

- Most pages are client components (`"use client"`); API routes are server-side
- Prisma client uses singleton pattern (`src/lib/db.ts`) to avoid multiple instances in dev
- **Authentication**: Auth.js v5 with JWT sessions, OAuth providers (Google, GitHub, Discord), Credentials provider in dev/test
- **Access gating**: Users have `accessStatus` ("pending" | "active" | "suspended") and `role` ("user" | "admin" | "owner"). `getAuthUser()` returns 403 for non-active users. `getAuthUserAnyStatus()` for routes accessible to pending users (redeem, payment). `requireAdmin()` / `requireOwner()` for admin/owner GET routes. `requireAdminFromRequest()` / `requireOwnerFromRequest()` for admin/owner mutation routes (CSRF-aware)
- **Data isolation**: Every `Course` belongs to a `User` via `userId`. All API routes call `getAuthUser()` then verify ownership
- **Dev bypass**: `AUTH_DEV_BYPASS=true` env var auto-creates/returns a dev user with active status, skipping real auth (used by E2E tests)
- **No middleware file** — auth is enforced per-route via `getAuthUser()` in each API handler and client-side redirects on pages. `src/proxy.ts` checks session tokens and routes pending users to redeem/payment paths
- Users supply their own AI provider API keys (Anthropic, OpenAI, Google), stored in browser localStorage via Zustand; optionally synced to server (encrypted with AES-256-GCM). Passed via `x-api-keys` JSON header (or legacy `x-api-key` for single key)
- Lesson content is a structured JSON schema with typed sections: text, math, definitions, theorems, visualizations, worked examples, practice exercises, code_block
- CourseEdge model defines prerequisite relationships between lessons with types: "prerequisite", "recommended", "related"
- **Full-viewport pages** (lesson page, course overview) use `fixed inset-0` wrapper — NOT `h-dvh`. This takes the page completely out of document flow, preventing the browser from creating a document-level scrollbar. Internal areas use `overflow-y-auto` for scrolling. The header is `shrink-0` and always visible; the content area is `flex-1 min-h-0`. When side panels (chat/scratchpad) are open, `main` gets `overflow-y-auto w-1/2`; when closed, the outer container gets `overflow-y-auto` instead. Switching between panels preserves the lesson content scroll position.

- **i18n**: i18next + react-i18next with `en` and `pl` locales. 22 namespaces under `src/i18n/locales/`. `I18nProvider` wraps the app in `layout.tsx`
- **i18n copywriting**: User-facing text must NOT reference specific AI provider names (Claude, Anthropic, OpenAI, etc.) — use generic "AI" instead. Exception: provider labels in the API key setup page. PL locale files must use proper Polish diacritics (ą, ę, ó, ś, ć, ź, ż, ł, ń).
- **Voice input**: `useSpeechToText` hook uses Web Speech API. `voiceKeywords` expands spoken math terms to LaTeX. Configurable trigger word and custom keywords in Zustand store
- **Notebook**: Per-course multi-page notebook with autosave. `useNotebook` hook manages CRUD via `/api/courses/[courseId]/notebook` routes. `NotebookPanel` renders in lesson sidebar (mutually exclusive with chat/scratchpad)
- **Color themes**: 4 themes (neutral, ocean, sage, amber) defined in `src/lib/themes.ts`. `colorTheme` stored in Zustand. Dark mode via `next-themes` `ThemeProvider`
- **Language toggle**: `LanguageToggle` component (`src/components/LanguageToggle.tsx`) cycles through available languages. Uses Zustand `setLanguage`. Available on landing page alongside `ThemeToggle`
- **Tooltips**: Use shadcn `<Tooltip>` + `<TooltipProvider>` from `@/components/ui/tooltip` for help hints — native `title` attribute renders as a white box in dark mode and ignores the theme. Wrap inline usage with its own `<TooltipProvider>` (no app-level provider exists).
- **MathMarkdown**: Render any content string that may contain LaTeX via `<MathMarkdown content={str} />` — plain `<span>` won't process `$...$`/`$$...$$` markup. Applies to exercise statements, hints, key points, and choice labels.

## Conventions

- **Client components** use `"use client"` directive, fetch data in `useEffect`, manage local state with `useState`
- **API routes** follow try/catch pattern with `NextResponse.json()` and consistent error shape `{ error: string }`. For cookie-authenticated **mutation handlers** (`POST`/`PUT`/`PATCH`/`DELETE`), call `getAuthUserFromRequest(request)` or `getAuthUserAnyStatusFromRequest(request)` first so CSRF checks (`Origin`, fallback `Referer`) run early. For read handlers (`GET`/`HEAD`), use `getAuthUser()` / `getAuthUserAnyStatus()` as appropriate. Third-party signed callbacks (e.g. Stripe webhook) stay exempt from CSRF guard and must rely on signature verification.
- **Prisma singleton** via `src/lib/db.ts` — always import `prisma` from there, never instantiate directly
- **Zustand store** (`src/stores/appStore.ts`) for global persisted state (API key, sidebar toggles, model selection); use custom hooks for local/transient state (e.g., `useScratchpad`)
- **Toast notifications** via `sonner` — `toast.success()`, `toast.error()`
- **Component organization**: `src/components/<feature>/` with barrel `index.ts` exports (e.g., `lesson/`, `math/`, `scratchpad/`, `quiz/`, `chat/`)
- **API keys** passed to generation endpoints via `x-api-keys` JSON header (or legacy `x-api-key` for single Anthropic key)
- **API key management API** (`src/app/api/user/api-key/route.ts`):
  - `GET` returns metadata only (never plaintext): `{ present, maskedSuffix, lastUpdated }` per provider
  - `PUT` replaces/updates only provided provider keys (merge semantics)
  - `DELETE` revokes either one provider (`?provider=...`) or all providers
  - Includes migration-safe parsing for legacy `encryptedApiKeys` JSON shapes (plaintext string values and older encrypted field names)
- **Content format**: lesson content stored as JSON string in `contentJson` field, parsed at render time
- **AI SDK v6**: `useChat` uses transport-based API — `TextStreamChatTransport` for text streaming, `sendMessage()` instead of `handleSubmit()`, `status` instead of `isLoading`, messages are `UIMessage` with `parts` array (not `content` string)
- **Turso/libsql**: `src/lib/db.ts` supports both local `file:` URLs (dev/test) and remote `libsql://` (Turso production). Set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` for production
- **Export**: `getFullCourseData()` is the shared data layer. `toMarkdown()` and `toExportJson()` are pure converters. JSON export includes `version` field for forward compat
- **Sharing**: `CourseShare` model with `shareToken` (UUID). Public routes at `/shared/[token]` and `/api/shared/[token]` skip auth. Cloning creates a deep copy under the current user
- **Print**: `/courses/[courseId]/print` renders all lessons with `@media print` stylesheet. KaTeX prints natively
- **Access codes**: `AccessCode` model with unique codes, `maxUses`/`currentUses` tracking, `isActive` flag. `AccessCodeRedemption` links codes to users. Redemption activates user (`accessStatus = "active"`)
- **Gallery**: Gallery listings are `CourseShare` records with `isGalleryListed = true`. Admin-only curation — regular users create share links, admins promote to gallery. `CourseRating` model for star ratings, `starCount`/`cloneCount` denormalized on `CourseShare`
- **Stripe payment**: One-time payment via Stripe Checkout. Webhook auto-generates an access code, redeems it, and activates the user. `Payment` model for audit trail. BLIK + card support
- **Admin panel**: `/admin` page with tabs for access codes, users, gallery management. Only `role === "admin"` users can access
- **Cheapest model utility**: `getCheapestModel(apiKeys)` + `getProviderOptions(model)` in `src/lib/ai/repairSchema.ts` — use for lightweight AI ops (grading, evaluation) instead of hardcoding model names.

## Security Hardening

Implemented security measures and ongoing hardening work:

1. **Atomic redemption and payment state transitions** (DONE)
   - Access code redemption uses conditional `updateMany` with guarded predicates to prevent race conditions around `maxUses`/`currentUses`.
   - Payment webhook activation is idempotent.

2. **Rate limiting for abuse-prone routes** (DONE)
   - In-memory fixed-window limiter (`src/lib/rate-limit.ts`) with per-user + IP-fallback keys.
   - Edge-level guard in `src/proxy.ts`: `edge:api` (120 req/60s) and stricter `edge:sensitive` (30 req/60s) for `/api/auth`, `/api/access-codes/redeem`, `/api/test-key`, `/api/payment/checkout`.
   - Per-route limits on: all `/api/generate/*`, chat, course create/clone/import, share mutations, access code redemption, API key validation.
   - Returns `429` with `Retry-After` and logs structured JSON events.

3. **CSRF / Origin protection on cookie-authenticated mutations** (DONE)
   - `src/lib/csrf.ts` validates `Origin`/`Referer` for all non-safe methods (POST/PUT/PATCH/DELETE).
   - Integrated via `getAuthUserFromRequest()`/`getAuthUserAnyStatusFromRequest()` — CSRF runs before auth.
   - Stripe webhook exempt (uses signature verification).

4. **Data minimization for AI logging** (DONE)
   - `AiGenerationLog` stores repair metadata but raw prompts/outputs are behind debug flags.
   - `generationLogRetention.ts` defines expiration for sensitive payloads; `logSanitizer.ts` redacts before storage.
   - Admin cleanup endpoint at `POST /api/admin/generation-logs/cleanup` (owner-only).

5. **Write-only API key UX** (DONE)
   - `GET /api/user/api-key` returns `{ present, maskedSuffix, lastUpdated }` per provider — never plaintext.
   - `PUT` for rotation/replacement, `DELETE` for revocation.

6. **Uniform request validation** (ONGOING)
   - Standardize on Zod validation for all API route inputs (body/query/path-derived fields).
   - Fail fast with consistent 4xx error payloads.

7. **Auditability of privileged actions** (ONGOING)
   - Structured audit logs for role/access changes, site-config edits, and admin curation actions.

8. **Operational security monitoring** (ONGOING)
   - Track repeated 401/403/429 patterns and webhook verification failures.

## Deployment

- **Platform**: Vercel (auto-deploys from `production` branch)
- **Database**: Turso (libsql) — set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
- **Build command**: `pnpm build` (runs `next build`)
- **Required env vars**: `AUTH_SECRET`, `NEXTAUTH_URL`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- **Optional env vars**: `GOOGLE_CLIENT_ID`/`SECRET`, `GITHUB_ID`/`SECRET`, `DISCORD_CLIENT_ID`/`SECRET` (OAuth providers), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` (payments), `API_KEY_ENCRYPTION_KEY` (server-side key storage)
- **Production secrets**: Stored in `.env.secret` (gitignored, NOT auto-loaded by Next.js). Contains `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `GH_TOKEN`, and AI provider keys for gallery seeding
- **Applying schema changes to production**: Prisma CLI (v7) cannot connect to `libsql://` URLs directly — the `migrate.adapter` config was removed in v7. Instead, apply migration SQL via the Turso HTTP API. Use the `/migrate-prod` skill to automate this
- **CRITICAL — Production database is user-controlled**: NEVER apply, execute, or modify the production database without explicit verbal confirmation from the user. This includes running `migrate-prod.mjs apply`, `backfill`, `drift --fix`, or any direct SQL against Turso. Read-only commands (`status`, `plan`, `drift`, `tables`, `inspect`) are safe to run. Always show the user what will change (`plan` output) and wait for their explicit approval before any write operation. No exceptions — even if a PR description says "run migrations after merge", the user must confirm first.
- **NEVER** set `TURSO_DATABASE_URL` in `.env.local` — it causes `pnpm dev` to write to the production database
- **Dev bypass production guard**: `isDevBypassEnabled()` in `src/lib/dev-bypass.ts` blocks `AUTH_DEV_BYPASS` in production (`NODE_ENV=production`) unless `NEXT_TEST_MODE=1` (E2E tests). Also logs a warning when bypass is active with a remote database (`TURSO_DATABASE_URL` set)

