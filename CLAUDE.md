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
- `/courses/[courseId]/lessons/[lessonId]` — Lesson viewer

## Tech Stack

Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Prisma 7 (SQLite/libsql), Zustand 5, Zod 4, Vercel AI SDK (`@ai-sdk/anthropic`, `ai`), KaTeX, mathjs, shadcn/ui, reagraph

## Key Patterns

- Most pages are client components (`"use client"`); API routes are server-side
- Prisma client uses singleton pattern (`src/lib/db.ts`) to avoid multiple instances in dev
- Users supply their own Anthropic API key, stored in browser localStorage via Zustand — never persisted server-side
- Lesson content is a structured JSON schema with typed sections: text, math, definitions, theorems, visualizations, worked examples, practice exercises
- CourseEdge model defines prerequisite relationships between lessons with types: "prerequisite", "recommended", "related"
