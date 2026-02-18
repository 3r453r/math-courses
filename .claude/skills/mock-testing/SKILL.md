---
name: mock-testing
description: Test frontend features using mock AI data without real API calls. Use when the user says "test with mock", "mock testing", "test FE", "explore with mock", or when you need to verify UI features without spending API tokens.
allowed-tools: Bash, Read, Glob, Grep, Edit, Write, mcp__plugin_playwright_playwright__browser_navigate, mcp__plugin_playwright_playwright__browser_snapshot, mcp__plugin_playwright_playwright__browser_click, mcp__plugin_playwright_playwright__browser_type, mcp__plugin_playwright_playwright__browser_fill_form, mcp__plugin_playwright_playwright__browser_take_screenshot, mcp__plugin_playwright_playwright__browser_evaluate, mcp__plugin_playwright_playwright__browser_wait_for, mcp__plugin_playwright_playwright__browser_press_key, mcp__plugin_playwright_playwright__browser_console_messages
argument-hint: [feature-to-test]
---

# Mock Testing — Test FE Features Without API Calls

## Overview

The app has a built-in **mock AI model** (`model: "mock"`) that returns hardcoded data from `src/lib/ai/mockData.ts` instead of calling real AI providers. This lets you verify UI rendering, navigation, and workflows without spending API tokens.

## How Mock Mode Works

1. Each `/api/generate/*` route checks `if (model === "mock")` in the request body
2. If mock, it returns hardcoded data from `mockData.ts` — no AI SDK call
3. The mock model is NOT in `MODEL_REGISTRY` — it's a special case handled by each route
4. Mock data includes: course structure (3 lessons), lesson content (text, definition, math, visualization sections), quizzes (10 questions), diagnostic, trivia, and completion summary

## Selecting Mock Mode

### Via Playwright (E2E / manual testing)

Seed localStorage before navigation to set the Zustand store:

```typescript
await page.addInitScript(([key, data]) => {
  try { localStorage.setItem(key, data); } catch {}
}, ["math-courses-app", JSON.stringify({
  state: {
    apiKeys: { anthropic: "test-key" },
    sidebarOpen: true,
    chatSidebarOpen: false,
    scratchpadOpen: false,
    notebookOpen: false,
    generationModel: "mock",
    chatModel: "mock",
    contextDocGuideDismissed: true,
  },
  version: 0,
})]);
```

The E2E helper `tests/e2e/helpers/seed.ts` (`seedMockMode(page)`) already does this.

### Via Browser (manual dev testing)

1. Start dev server: `pnpm dev`
2. Navigate to `/setup`
3. In the **Model** dropdown, select **"Mock (Testing)"**
4. Set any dummy API key (e.g., `test-key`) so the app doesn't redirect to /setup

### Via API Requests

Pass `"model": "mock"` in the request body along with any required `x-api-keys` header:

```bash
curl -X POST http://localhost:3000/api/generate/course \
  -H "Content-Type: application/json" \
  -H "x-api-keys: {\"anthropic\":\"test-key\"}" \
  -d '{"model":"mock","topic":"Test","description":"Test course","language":"en","difficulty":"intermediate","targetLessonCount":3}'
```

## Testing Workflow (Playwright)

### Full course lifecycle test

```
1. Navigate to /courses/new
2. Fill topic form → click Generate Course
3. Wait for redirect to /courses/[id] (mock generation is instant)
4. Verify course overview shows "Mock Test Course" with 3 lessons
5. Click a lesson → Generate → verify content renders (text, math, visualization)
6. Navigate to quiz → answer questions → verify scoring
```

### What mock data includes

| Route | Mock Function | What It Returns |
|-------|--------------|-----------------|
| `/api/generate/course` | `mockCourseStructure()` | 3 lessons, 2 edges, contextDoc |
| `/api/generate/lesson` | `mockLessonContent()` + `mockQuiz()` | Content with text/definition/math/visualization sections, 10 quiz questions |
| `/api/generate/quiz` | `mockQuiz()` | 10 multiple-choice questions (addition/arithmetic) |
| `/api/generate/diagnostic` | `mockDiagnostic()` | 10 diagnostic questions, 2 prerequisites |
| `/api/generate/trivia` | `mockTrivia()` | 20 math trivia slides |
| `/api/generate/completion-summary` | `mockCompletionSummary()` | Narrative + recommendation |

## Key Files

- `src/lib/ai/mockData.ts` — All mock data functions
- `tests/e2e/helpers/seed.ts` — `seedMockMode(page)` helper for E2E tests
- Each route in `src/app/api/generate/` has a `if (model === "mock")` early return

## Gotchas

- **Chat doesn't support mock mode** — the `/api/chat` route uses `streamText`, not `generateObject`, and doesn't have a mock path. Chat sidebar will fail with mock model selected.
- **Mock data is static** — the same content is returned every time. Lesson titles in the course structure won't match the topic you entered in the form (they're always "Mock Lesson 1/2/3").
- **Quiz answers are deterministic** — choice "a" is always correct. Good for testing scoring UI but not for testing randomized behavior.
- **API key still required** — the app checks for API key presence before allowing navigation. Set any dummy value (e.g., `test-key`).
