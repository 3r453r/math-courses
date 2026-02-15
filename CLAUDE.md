# CLAUDE.md

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
- `src/lib/ai/schemas/` — Zod schemas: `courseSchema`, `lessonSchema`, `lessonWithQuizSchema`, `quizSchema`, `diagnosticSchema`
- `src/lib/ai/prompts/` — Prompt builders: `courseStructure`, `quizGeneration`
- `src/lib/content/` — Content utilities including `safeEval.ts` (mathjs-based, no `eval()`)
- `src/lib/quiz/` — Quiz scoring algorithm (≥80% advance, ≥50% supplement, <50% regenerate)
- `src/stores/appStore.ts` — Zustand store persisted to localStorage (API key, model selection, UI state)
- `src/components/ui/` — shadcn/ui components (New York style, Radix UI primitives)
- `src/components/chat/` — AI tutor chat sidebar (ChatPanel, ChatMessage, ChatInput)
- `src/components/scratchpad/` — Per-lesson scratchpad with LaTeX slash-commands
- `src/components/lesson/` — Lesson content renderer, section renderers, MathMarkdown
- `src/lib/auth.ts` — Auth.js v5 configuration (OAuth providers, JWT sessions, Credentials dev bypass)
- `src/lib/auth-utils.ts` — `getAuthUser()`, `getAuthUserAnyStatus()`, `requireAdmin()`, `requireOwner()`, `verifyCourseOwnership()`, `verifyLessonOwnership()` helpers
- `src/lib/stripe.ts` — Stripe client singleton for payment processing
- `src/components/admin/` — Admin panel components (AccessCodeManager, UserManager, GalleryManager)
- `src/components/gallery/` — Gallery components (GalleryCard, StarRating, GalleryFilters)
- `src/lib/crypto.ts` — AES-256-GCM encryption for server-side API key storage
- `src/lib/export/` — Export utilities: `courseData.ts` (shared data layer), `toMarkdown.ts`, `toJson.ts`
- `src/components/export/` — ExportDialog (Markdown/JSON/Print), ShareDialog (share link CRUD)
- `src/app/shared/[shareToken]/` — Public read-only course viewer (no auth required)
- `src/app/courses/[courseId]/print/` — Print-optimized page for browser Print-to-PDF
- `src/hooks/` — Custom hooks: `useApiHeaders`, `useNotebook`, `useScratchpad`, `useSpeechToText`
- `src/i18n/` — i18next configuration + locale files (`en`, `pl`) with 17 namespaces
- `src/components/notebook/` — Per-course notebook (NotebookPanel, NotebookPageList, NotebookPageNav)
- `src/lib/speech/` — Voice input: `speechManager`, `languageMap`, `voiceKeywords` (math keyword → LaTeX expansion)
- `src/lib/themes.ts` — Color theme definitions (neutral, ocean, sage, amber)
- `prisma/schema.prisma` — Database schema (User, Account, Session, VerificationToken, Course, Lesson, CourseEdge, Quiz, QuizAttempt, DiagnosticQuiz, DiagnosticAttempt, Note, ChatMessage, CourseShare, AccessCode, AccessCodeRedemption, CourseRating, CourseCompletionSummary, Payment)

### AI Generation Flow

1. `POST /api/generate/course` — AI generates course structure (lessons + DAG edges) + a pedagogical context document (`contextDoc`) using `courseStructureSchema`
2. `POST /api/generate/lesson` — Two sequential `generateObject` calls: first generates lesson content (`lessonContentSchema`), then generates quiz (`quizSchema`) with the lesson content as context. The course `contextDoc` is injected into the lesson prompt. On regeneration with weak topics, quiz questions are weighted 50%+ toward weak areas.
3. `POST /api/generate/quiz` — Standalone quiz generation (fallback/regenerate-only). Also receives `lessonContent` and `contextDoc` when available.
4. `POST /api/chat` — Streaming AI tutor chat using `streamText` + `toTextStreamResponse()`. Client uses `TextStreamChatTransport` from AI SDK v6.
5. **Multi-provider AI**: `MODEL_REGISTRY` in `src/lib/ai/client.ts` supports 3 providers (Anthropic, OpenAI, Google) with 9 models. Users store per-provider API keys. `getProviderForModel()` selects the right SDK client. Two model tiers: primary (generation) and chat — user-configurable

### Content Rendering

- KaTeX for math (`$...$` inline, `$$...$$` display) via remark-math + rehype-katex
- mathjs for safe expression evaluation (function plots, vector fields, parametric surfaces)
- reagraph for prerequisite graph visualization

### Routes

- `/login` — Login page (OAuth + dev credentials)
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
- `/redeem` — Access code redemption (pending users)
- `/admin` — Admin panel: access codes, users, gallery management (admin only)
- `/gallery` — Public course gallery with search, filters, ratings, clone
- `/pricing` — Pricing/landing page with Stripe checkout
- `/payment/success` — Post-payment confirmation
- `/payment/cancel` — Payment cancelled page

## Tech Stack

Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Prisma 7 (SQLite/libsql), Auth.js v5 (next-auth@beta), Zustand 5, Zod 4, Vercel AI SDK (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `ai`), Stripe, KaTeX, mathjs, Three.js, Mafs, i18next, react-i18next, next-themes, shadcn/ui, reagraph

## Key Patterns

- Most pages are client components (`"use client"`); API routes are server-side
- Prisma client uses singleton pattern (`src/lib/db.ts`) to avoid multiple instances in dev
- **Authentication**: Auth.js v5 with JWT sessions, OAuth providers (Google, GitHub, Discord), Credentials provider in dev/test
- **Access gating**: Users have `accessStatus` ("pending" | "active" | "suspended") and `role` ("user" | "admin" | "owner"). `getAuthUser()` returns 403 for non-active users. `getAuthUserAnyStatus()` for routes accessible to pending users (redeem, payment). `requireAdmin()` for admin/owner routes. `requireOwner()` for owner-only routes
- **Data isolation**: Every `Course` belongs to a `User` via `userId`. All API routes call `getAuthUser()` then verify ownership
- **Dev bypass**: `AUTH_DEV_BYPASS=true` env var auto-creates/returns a dev user with active status, skipping real auth (used by E2E tests)
- **No middleware file** — auth is enforced per-route via `getAuthUser()` in each API handler and client-side redirects on pages. `src/proxy.ts` checks session tokens and routes pending users to redeem/payment paths
- Users supply their own AI provider API keys (Anthropic, OpenAI, Google), stored in browser localStorage via Zustand; optionally synced to server (encrypted with AES-256-GCM). Passed via `x-api-keys` JSON header (or legacy `x-api-key` for single key)
- Lesson content is a structured JSON schema with typed sections: text, math, definitions, theorems, visualizations, worked examples, practice exercises, code_block
- CourseEdge model defines prerequisite relationships between lessons with types: "prerequisite", "recommended", "related"
- **Full-viewport pages** (lesson page, course overview) use `fixed inset-0` wrapper — NOT `h-dvh`. This takes the page completely out of document flow, preventing the browser from creating a document-level scrollbar. Internal areas use `overflow-y-auto` for scrolling. The header is `shrink-0` and always visible; the content area is `flex-1 min-h-0`. When side panels (chat/scratchpad) are open, `main` gets `overflow-y-auto w-1/2`; when closed, the outer container gets `overflow-y-auto` instead. Switching between panels preserves the lesson content scroll position.

- **i18n**: i18next + react-i18next with `en` and `pl` locales. 17 namespaces under `src/i18n/locales/`. `I18nProvider` wraps the app in `layout.tsx`
- **Voice input**: `useSpeechToText` hook uses Web Speech API. `voiceKeywords` expands spoken math terms to LaTeX. Configurable trigger word and custom keywords in Zustand store
- **Notebook**: Per-course multi-page notebook with autosave. `useNotebook` hook manages CRUD via `/api/courses/[courseId]/notebook` routes. `NotebookPanel` renders in lesson sidebar (mutually exclusive with chat/scratchpad)
- **Color themes**: 4 themes (neutral, ocean, sage, amber) defined in `src/lib/themes.ts`. `colorTheme` stored in Zustand. Dark mode via `next-themes` `ThemeProvider`

## Conventions

- **Client components** use `"use client"` directive, fetch data in `useEffect`, manage local state with `useState`
- **API routes** follow try/catch pattern with `NextResponse.json()` and consistent error shape `{ error: string }`. Every route starts with `const { userId, error } = await getAuthUser(); if (error) return error;` — exceptions: `/api/shared/[shareToken]` and `/api/gallery` are public (no auth); `/api/access-codes/redeem` and `/api/payment/checkout` use `getAuthUserAnyStatus()` (pending users OK); admin routes use `requireAdmin()`
- **Prisma singleton** via `src/lib/db.ts` — always import `prisma` from there, never instantiate directly
- **Zustand store** (`src/stores/appStore.ts`) for global persisted state (API key, sidebar toggles, model selection); use custom hooks for local/transient state (e.g., `useScratchpad`)
- **Toast notifications** via `sonner` — `toast.success()`, `toast.error()`
- **Component organization**: `src/components/<feature>/` with barrel `index.ts` exports (e.g., `lesson/`, `math/`, `scratchpad/`, `quiz/`, `chat/`)
- **API keys** passed to generation endpoints via `x-api-keys` JSON header (or legacy `x-api-key` for single Anthropic key)
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

## Roadmap

- Phase 1: Foundation — Next.js app, Prisma schema, AI course generation, setup page (DONE)
- Phase 2: Lesson Content Rendering — KaTeX, visualizations, worked examples, practice exercises (DONE)
- Phase 3: Assessment System — quizzes, diagnostics, scoring, adaptive recommendations (DONE)
- Phase 4: Lesson Scratchpad — per-lesson notes editor with LaTeX slash-commands, autosave (DONE)
- Phase 5: Context doc, co-generation, AI chat sidebar, topic-agnostic rebranding (DONE)
- Phase 6: Progress Tracking & Dashboard — completion status, score history, course progress (DONE)
- Phase 7: Multi-user auth (Auth.js v5), data isolation, middleware, server-side API key storage (DONE)
- Phase 8: Export/Sharing — Markdown/JSON export, JSON import, share links, course cloning, print-to-PDF (DONE)
- Phase 9: Access Gating, Payment & Course Gallery — access codes, roles, Stripe payment, admin panel, public course gallery (DONE)
- Phase 10: Polish & UX — animations, responsive design, dark mode, keyboard navigation, i18n, voice input, notebook, color themes (DONE)

## Deployment

- **Platform**: Vercel (auto-deploys from `production` branch)
- **Database**: Turso (libsql) — set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
- **Build command**: `pnpm build` (runs `next build`)
- **Required env vars**: `AUTH_SECRET`, `NEXTAUTH_URL`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- **Optional env vars**: `GOOGLE_CLIENT_ID`/`SECRET`, `GITHUB_ID`/`SECRET`, `DISCORD_CLIENT_ID`/`SECRET` (OAuth providers), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` (payments), `API_KEY_ENCRYPTION_KEY` (server-side key storage)

