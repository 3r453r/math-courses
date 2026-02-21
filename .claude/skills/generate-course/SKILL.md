---
name: generate-course
description: Generate full gallery courses (structure + lessons + quizzes) via seed-gallery script, diagnose AI generation failures, and recover from errors. Use when the user says "generate course", "seed gallery", "run gallery seeder", "check generation errors", or "fix failed generation".
allowed-tools: Bash, Read, Glob, Grep, Edit, Write, Task, WebFetch
argument-hint: [run|dry-run|diagnose|recover <slug>|status]
---

# Generate Gallery Courses

## Overview

The gallery seeding pipeline generates full AI-powered courses (structure, lessons, quizzes) and publishes them directly to the production Turso database. It bypasses web auth entirely — credentials come from `.env.secret`.

**Script**: `scripts/seed-gallery.mts`
**Input**: `scripts/gallery-courses.json`
**State**: `scripts/.seed-state.json` (tracks progress, enables resume)

---

## Step-by-Step: Full Course Generation

### 1. Prerequisites

Before running, verify:

```bash
# Check .env.secret has all required keys
cat .env.secret | grep -E "^(TURSO_|ANTHROPIC_|OPENAI_|GOOGLE_)" | sed 's/=.*/=.../'
```

Required:
- `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` — production database
- At least ONE of: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`

### 2. Preview (Dry Run)

Always dry-run first to validate the course catalog:

```bash
pnpm seed:gallery:dry-run
# Or for a single course:
npx tsx scripts/seed-gallery.mts --dry-run --course linear-algebra-101
```

Dry run shows: course count, lesson targets, models, tags. No AI calls, no DB writes.

### 3. Generate a Single Course (Recommended First)

Test with one course before running the full batch:

```bash
npx tsx scripts/seed-gallery.mts --course linear-algebra-101
```

This runs the full pipeline for one course:
1. **Generate structure** — AI produces title, description, lesson DAG, contextDoc
2. **Save structure** — Creates Course, Lesson, CourseEdge records in production DB
3. **Generate lessons** (parallel, default concurrency 3):
   - Generate lesson content via `lessonContentSchema` + three-layer repair
   - Validate visualizations (remove malformed function_plots, vector_fields, etc.)
   - Save `contentJson` to Lesson record
   - Generate quiz via `quizSchema` + three-layer repair
   - Save Quiz record
4. **Create gallery listing** — CourseShare with `isGalleryListed = true`
5. **Update state file** — marks course complete

### 4. Generate Full Batch

```bash
pnpm seed:gallery
```

Processes all courses in `gallery-courses.json` sequentially. Each course's lessons run in parallel (concurrency 3).

### 5. Verify in Production

After generation, check the gallery:
- Visit `/gallery` in production to see listed courses
- Check `/shared/<shareToken>` for the public course viewer
- Review `/admin` generation logs tab for repair pipeline stats

---

## CLI Reference

```bash
npx tsx scripts/seed-gallery.mts [options]

Options:
  --input <file>       Course specs JSON (default: scripts/gallery-courses.json)
  --model <id>         Override AI model for all courses (default: claude-sonnet-4-5-20250929)
  --concurrency <n>    Parallel lesson generations (default: 3)
  --dry-run            Preview only — no AI calls, no DB writes
  --no-resume          Start fresh, ignore .seed-state.json
  --course <slug>      Generate only one specific course
```

Each course in `gallery-courses.json` can override `--model` with its own `"model"` field.

---

## Resume / Retry

The script tracks progress in `scripts/.seed-state.json`. On re-run:

- **Completed courses** are skipped entirely
- **Partially completed courses** resume from the first incomplete lesson
- **Failed lessons** are retried automatically

To force a clean start: `npx tsx scripts/seed-gallery.mts --no-resume`

To reset just one course: edit `.seed-state.json` and delete that course's entry.

---

## Diagnosing Generation Errors

### Step 1: Check the Seeder Output

The script logs every generation attempt with timing and repair layer info:

```
[slug/structure] Generated in 12.3s (layer 0)
[slug/lesson:Title] Generated in 45.2s (layer 0 + repair)
[slug/lesson:Title] Layer 0 failed, trying layer 1...
[slug/lesson:Title] FAILED: All repair layers failed
```

Key patterns:
- `(layer 0)` — clean generation, no issues
- `(layer 0 + repair)` — repair function was called but succeeded
- `Layer 0 failed, trying layer 1...` — schema mismatch, coercion attempted
- `Trying layer 2 (AI repack with ...)` — using a cheap model to fix structure
- `FAILED: All repair layers failed` — total failure, needs investigation

### Step 2: Check Production Generation Logs

Query the production database for recent failures:

```bash
node scripts/migrate-prod.mjs inspect AiGenerationLog
```

To query generation logs directly via Turso HTTP API, you can adapt a query from `migrate-prod.mjs`:

```bash
# Quick stats on recent outcomes
node -e "
const { readFileSync } = require('fs');
const env = {};
for (const line of readFileSync('.env.secret','utf-8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.+)/);
  if (m) env[m[1]] = m[2];
}
fetch(env.TURSO_DATABASE_URL.replace('libsql://','https://') + '/v2/pipeline', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + env.TURSO_AUTH_TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ requests: [{ type: 'execute', stmt: {
    sql: 'SELECT outcome, COUNT(*) as cnt FROM AiGenerationLog WHERE createdAt > datetime(\"now\", \"-1 day\") GROUP BY outcome ORDER BY cnt DESC'
  }}]})
}).then(r => r.json()).then(d => console.log(JSON.stringify(d.results[0]?.response?.result?.rows, null, 2)))
"
```

Or use the admin panel UI at `/admin` > Generation Logs tab.

### Step 3: Check Admin Panel (if app is running)

The GenerationLogManager UI at `/admin` provides:
- **Filtering** by type (course/lesson/quiz), outcome (success/failed/repaired_*), model, date range
- **Detail modal** with full repair pipeline visualization (L0, L1, L2 status)
- **Zod error table** showing exactly which fields failed validation
- **Raw output** (collapsible) — the actual AI response that failed parsing
- **Report download** — JSON bundle with log + schema source + analysis instructions

### Step 4: Pull Problematic Data to Local DB for Debugging

If a course or lesson failed and you need to inspect it locally:

```bash
# 1. Find the problematic course ID from .seed-state.json
cat scripts/.seed-state.json | grep -A2 "SLUG_NAME"

# 2. Pull the course record
node -e "
// ... (same env setup as above)
// Query: SELECT * FROM Course WHERE id = 'COURSE_ID'
"

# 3. For lesson content debugging, fetch the raw AI output from generation logs
# In admin panel: filter by courseId + outcome=failed, download report
```

For deeper debugging, create a local reproduction:

1. Find the generation log entry in the admin panel
2. Download the report (includes raw output + schema source)
3. The raw output can be fed through the repair pipeline locally:

```typescript
import { tryCoerceAndValidate, unwrapParameter } from "./src/lib/ai/repairSchema";
import { lessonContentSchema } from "./src/lib/ai/schemas/lessonSchema";

const rawOutput = JSON.parse(/* paste raw output from report */);
const { unwrapped } = unwrapParameter(rawOutput);
const result = tryCoerceAndValidate(unwrapped, lessonContentSchema);
console.log(result ? "Coercion succeeded" : "Coercion failed");
```

---

## Provider-Specific Notes

### Anthropic (Claude)

The repair pipeline was built primarily for Anthropic's `jsonTool` mode quirks:
- **Parameter wrapping**: `{"parameter": {...}}` or `{"parameter": "...stringified..."}` — handled by `unwrapParameter()`
- **Stringified arrays**: Array fields returned as JSON strings — handled by `coerceToSchema()`
- **Unescaped quotes in Polish/special content** — handled by `repairJsonString()`

These are well-tested. Anthropic generations should have near-zero failure rate.

### OpenAI (GPT)

Expected issues to watch for:
- **Different structured output format** — OpenAI uses native JSON mode, not tool-calling. May not need `unwrapParameter()` but could have its own wrapping quirks
- **Schema compliance** — GPT models may add extra fields or use slightly different enum values. `coerceToSchema()` strips unknown fields and fuzzy-matches enums, which should help
- **Rate limits** — OpenAI's 429 responses use different headers. The script already does exponential backoff on any 429
- **Token limits** — Large lesson schemas may exceed GPT's output token limit. Watch for truncated JSON

If OpenAI failures emerge, the recovery pipeline to build:
1. Check if raw output is truncated (ends mid-JSON) — may need to request smaller lessons
2. Check if extra fields are causing Zod validation failures — `coerceToSchema` should handle this
3. Check if enum values differ — fuzzy matching in `coerceToSchema` covers most cases

### Google (Gemini)

Expected issues to watch for:
- **Gemini's structured output** — Uses different constrained decoding. May produce output that's valid JSON but doesn't match the schema in subtle ways
- **Nested object handling** — Gemini sometimes flattens or restructures nested objects
- **Array ordering** — May reorder array elements relative to what was requested
- **Content safety filters** — Gemini may refuse to generate certain content silently, producing incomplete output

If Gemini failures emerge, the recovery pipeline to build:
1. Check for empty sections/arrays — may need to adjust prompts for Gemini
2. Check for flattened nested structures — may need Gemini-specific coercion rules
3. Check for safety filter truncation — look for `finishReason: "SAFETY"` in raw responses

---

## Adding New Courses to the Catalog

Edit `scripts/gallery-courses.json`:

```json
{
  "slug": "unique-slug-name",
  "topic": "Topic Name",
  "description": "2-3 sentence description of the course",
  "focusAreas": ["Area 1", "Area 2", "Area 3"],
  "lessonCount": 10,
  "difficulty": "intermediate",
  "language": "en",
  "model": "claude-sonnet-4-5-20250929",
  "galleryTags": ["category1", "category2"]
}
```

Fields:
- `slug` — unique identifier, used in state tracking
- `topic` — passed to AI as the course subject
- `description` — injected into the course structure prompt
- `focusAreas` — specific subtopics to emphasize
- `lessonCount` — target number of lessons (AI may adjust slightly)
- `difficulty` — "introductory", "intermediate", or "advanced"
- `language` — ISO 639-1 code (e.g., "en", "pl", "de")
- `model` — (optional) per-course model override
- `galleryTags` — (optional) tags for gallery filtering

---

## Cost Estimates

Per course (~10 lessons):
- **Claude Sonnet 4.5**: ~$1.50–3.50
- **GPT-5 Mini**: ~$0.50–1.50 (estimated)
- **Gemini 2.5 Flash**: ~$0.20–0.80 (estimated)

Each course requires: 1 structure call + N lesson calls + N quiz calls = 2N+1 AI calls.

---

## Troubleshooting Checklist

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "No AI provider API keys found" | Missing keys in `.env.secret` | Add at least one provider key |
| "Turso API 401" | Bad `TURSO_AUTH_TOKEN` | Regenerate token in Turso dashboard |
| Rate limited (429) | Too many concurrent requests | Reduce `--concurrency` to 1-2 |
| "All repair layers failed" | Schema mismatch the pipeline can't fix | Check admin logs, file a report, may need provider-specific coercion |
| "Lesson generation produced empty sections" | AI returned malformed sections array | Retry; if persistent, check raw output in generation log |
| Course appears in state but not in gallery | Gallery listing step failed | Re-run same command, it will skip completed lessons and create listing |
| Quiz generation fails but lesson succeeded | Quiz schema validation failed | Re-run; script will skip the completed lesson content and retry quiz only |

---

## Offline Batch Generation (course-library)

An alternative workflow for bulk generation without the seed-gallery production pipeline.
Used when generating large batches of courses as static JSON files for later bulk import.

### Workflow

1. Write generation scripts per course: `scripts/gen-SLUG-part1.mjs` (lessons 0–3) and `gen-SLUG-part2.mjs` (lessons 4–7)
2. Run them: `node scripts/gen-SLUG-part1.mjs && node scripts/gen-SLUG-part2.mjs`
3. Each script outputs to `course-library/anthropic-json/SLUG-part{1,2}-tmp.json`
4. Write an assembler `scripts/assemble-batchN.mjs` that merges the tmp files into a final JSON
5. Run assembler: `node scripts/assemble-batchN.mjs`
6. Import all final JSON files to local gallery: `node scripts/import-gallery-local.mjs`

Track generation progress in `course-library/generation-progress.md`.

### Correct JSON Format for Assembler Scripts

The assembler should produce this structure. Fields marked **required** must be present; others have safe defaults in the importer.

```javascript
{
  version: 1,
  exportedAt: new Date().toISOString(),
  course: {
    title: "...",
    topic: "...",
    description: "...",
    subject: "Mathematics",          // string — importer wraps in ["..."]
    focusAreas: ["Area 1", "..."],   // array
    targetLessonCount: 8,
    difficulty: "intermediate",      // "introductory" | "intermediate" | "advanced"
    language: "en",                  // ISO 639-1
    contextDoc: "...",
    passThreshold: 80,
    noLessonCanFail: false,
    lessonFailureThreshold: 50,
    status: "ready",                 // REQUIRED — must be present
  },
  lessons: [
    {
      orderIndex: 0,                 // REQUIRED — integer index
      title: "...",
      summary: "...",
      status: "ready",              // recommended; importer defaults to "ready" if missing
      contentJson: "...",           // JSON string (lessonContentSchema output)
      quizzes: [
        {
          questionsJson: "...",     // JSON string (array of quiz questions)
          questionCount: 5,         // recommended; importer counts from questionsJson if missing
          status: "ready",          // recommended; importer defaults to "ready" if missing
          generation: 1,            // importer defaults to 1 if missing
          isActive: true,           // importer defaults to true if missing
        }
      ]
    }
    // ... more lessons
  ],
  edges: [
    // Use integer indices — simplest and most explicit:
    { fromLessonIndex: 0, toLessonIndex: 1, relationship: "prerequisite" }
    // Also accepted by import-gallery-local.mjs:
    // { fromIndex: 0, toIndex: 1, type: "prerequisite" }            (older batch format)
    // { fromLessonId: "slug-lesson-0", toLessonId: "slug-lesson-1", relationship: "prerequisite" }  (batch 7 format)
  ]
}
```

**Recommended edge format going forward**: use `{ fromLessonIndex, toLessonIndex, relationship }` — it matches the standard export format and the import script's type definitions.

### Importing to Local Gallery

```bash
node scripts/import-gallery-local.mjs --dry-run   # preview — no DB writes
node scripts/import-gallery-local.mjs              # import all JSON files
node scripts/import-gallery-local.mjs --file SLUG  # import one specific course
```

- Skips courses whose `topic` already exists in `dev.db` (idempotent re-runs)
- Creates a `CourseShare` record with `isGalleryListed = true` for each imported course
- Handles all three edge formats (auto-detects by key names)
- Defaults missing `status`, `questionCount`, `isActive` fields gracefully
- Requires `dev.db` to exist (run `pnpm dev` or `npx prisma db push` first)

### Polish Language Gotcha — Apostrophe in JS String Literals

Polish genitive case uses an apostrophe before suffixes on foreign-origin names:
- "Froude'a" (of Froude), "Lagrange'a" (of Lagrange), "Clairaut'a" (of Clairaut)

Inside **single-quoted** JS string literals in generation scripts, this breaks syntax:

```javascript
// ❌ SyntaxError — apostrophe in "Froude'a" terminates the string:
const text = 'równanie Froude'a i liczba Reynoldsa';

// ✅ Option 1: Use Unicode right single quotation mark U+2019 (visually identical):
const text = 'równanie Froude\u2019a i liczba Reynoldsa';

// ✅ Option 2: Use double-quoted strings for sections containing Polish apostrophes:
const text = "równanie Froude'a i liczba Reynoldsa";

// ✅ Option 3: Fix existing scripts with Python (reads real Unicode in replacement):
// python -c "
// import sys
// content = open('script.mjs', encoding='utf-8').read()
// content = content.replace(\"Froude'a\", 'Froude\u2019a')
// open('script.mjs', 'w', encoding='utf-8').write(content)
// "
```

The Unicode U+2019 character `'` is visually indistinguishable from `'` in most fonts and renders correctly in all Polish text contexts. **This applies to any foreign name that Polish writers decline**: Newton → Newtona, Fourier → Fouriera (no apostrophe needed), but Froude → Froude'a, Lagrange → Lagrange'a (apostrophe before vowel suffix).
