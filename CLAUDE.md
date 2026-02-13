# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered math learning platform built with Next.js 16. Users provide a topic and preferences, and Claude generates structured courses with lessons organized as a directed acyclic graph (DAG) of prerequisites — not a flat sequence. Lessons can be studied in parallel when they share the same prerequisites.

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

No test framework is configured.

## Architecture

**Monorepo (single package):** Next.js App Router with API routes, SQLite via Prisma + libsql adapter, Vercel AI SDK for Claude integration.

### Key Directories

- `src/app/api/` — Server-side API routes (course CRUD, AI generation endpoints)
- `src/lib/ai/` — AI client config, prompt templates, Zod schemas for structured AI output
- `src/lib/content/` — Content utilities including `safeEval.ts` (mathjs-based, no `eval()`)
- `src/lib/quiz/` — Quiz scoring algorithm (≥80% advance, ≥50% supplement, <50% regenerate)
- `src/stores/appStore.ts` — Zustand store persisted to localStorage (API key, model selection, UI state)
- `src/components/ui/` — shadcn/ui components (New York style, Radix UI primitives)
- `prisma/schema.prisma` — Database schema (Course, Lesson, CourseEdge, Quiz, Note, ChatMessage)

### AI Generation Flow

1. `POST /api/generate/course` — AI generates course structure (lessons + prerequisite DAG edges) using `courseStructureSchema`
2. `POST /api/generate/lesson` — AI generates individual lesson content using `lessonContentSchema`
3. Two model tiers: Opus for generation, Sonnet for chat — configurable in `src/lib/ai/client.ts` and user settings

### Content Rendering

- KaTeX for math (`$...$` inline, `$$...$$` display) via remark-math + rehype-katex
- mathjs for safe expression evaluation (function plots, vector fields, parametric surfaces)
- reagraph for prerequisite graph visualization

### Routes

- `/` — Dashboard with course list
- `/setup` — API key and model configuration
- `/courses/new` — Course creation wizard
- `/courses/[courseId]` — Course overview with dependency graph
- `/courses/[courseId]/lessons/[lessonId]` — Lesson viewer with scratchpad panel
- `/courses/[courseId]/lessons/[lessonId]/quiz` — Lesson quiz

## Tech Stack

Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Prisma 7 (SQLite/libsql), Zustand 5, Zod 4, Vercel AI SDK (`@ai-sdk/anthropic`, `ai`), KaTeX, mathjs, shadcn/ui, reagraph

## Key Patterns

- Most pages are client components (`"use client"`); API routes are server-side
- Prisma client uses singleton pattern (`src/lib/db.ts`) to avoid multiple instances in dev
- Users supply their own Anthropic API key, stored in browser localStorage via Zustand — never persisted server-side
- Lesson content is a structured JSON schema with typed sections: text, math, definitions, theorems, visualizations, worked examples, practice exercises
- CourseEdge model defines prerequisite relationships between lessons with types: "prerequisite", "recommended", "related"

## Conventions

- **Client components** use `"use client"` directive, fetch data in `useEffect`, manage local state with `useState`
- **API routes** follow try/catch pattern with `NextResponse.json()` and consistent error shape `{ error: string }`
- **Prisma singleton** via `src/lib/db.ts` — always import `prisma` from there, never instantiate directly
- **Zustand store** (`src/stores/appStore.ts`) for global persisted state (API key, sidebar toggles, model selection); use custom hooks for local/transient state (e.g., `useScratchpad`)
- **Toast notifications** via `sonner` — `toast.success()`, `toast.error()`
- **Component organization**: `src/components/<feature>/` with barrel `index.ts` exports (e.g., `lesson/`, `math/`, `scratchpad/`, `quiz/`)
- **API key** passed to generation endpoints via `x-api-key` header
- **Content format**: lesson content stored as JSON string in `contentJson` field, parsed at render time

## Roadmap

- Phase 1: Foundation — Next.js app, Prisma schema, AI course generation, setup page (DONE)
- Phase 2: Lesson Content Rendering — KaTeX, visualizations, worked examples, practice exercises (DONE)
- Phase 3: Assessment System — quizzes, diagnostics, scoring, adaptive recommendations (DONE)
- Phase 4: Lesson Scratchpad — per-lesson notes editor with LaTeX slash-commands, autosave (CURRENT)
- Phase 5: AI Chat Sidebar — conversational tutor for asking questions during study
- Phase 6: Progress Tracking & Dashboard — completion status, score history, course progress
- Phase 7: Polish & UX — animations, responsive design, dark mode, keyboard navigation
- Phase 8: Export/Sharing — export courses as PDF/markdown, share between users
