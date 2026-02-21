#!/usr/bin/env tsx
/**
 * Gallery Seeding Script
 *
 * Generates AI-powered courses and publishes them to the gallery.
 * Connects directly to the production Turso database — bypasses web auth entirely.
 *
 * Usage:
 *   npx tsx scripts/seed-gallery.mts [options]
 *
 * Options:
 *   --input <file>       Course specs JSON (default: scripts/gallery-courses.json)
 *   --model <id>         AI model (default: claude-sonnet-4-5-20250929)
 *   --concurrency <n>    Parallel lesson generations (default: 3)
 *   --dry-run            Preview without calling AI or writing to DB
 *   --no-resume          Don't skip completed courses/lessons
 *   --course <slug>      Generate only a specific course by slug
 *   --user <email>       Use existing user by email (default: find/create admin)
 *   --phase-log <file>   Path to generation-log.json for experiment tracking
 *   --phase-name <name>  Phase name to update in generation-log (e.g. "opus", "sonnet")
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";

// ─── Environment ─────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname!, "..");
const ENV_FILE = join(ROOT, ".env.secret");
const STATE_FILE = join(ROOT, "scripts", ".seed-state.json");
const LOG_DIR = join(ROOT, "scripts", "logs");

function loadEnvSecret(): Record<string, string> {
  if (!existsSync(ENV_FILE)) {
    console.error(`ERROR: ${ENV_FILE} not found.`);
    console.error("This file must contain TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, and AI provider keys.");
    process.exit(1);
  }
  const env: Record<string, string> = {};
  for (const line of readFileSync(ENV_FILE, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

// ─── FileLogger ──────────────────────────────────────────────────────────────

class FileLogger {
  private logPath: string;
  attempts = 0;
  failures = 0;

  constructor(label: string) {
    mkdirSync(LOG_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    this.logPath = join(LOG_DIR, `seed-${label}-${ts}.log`);
    this.write(`=== Gallery Seed Log: ${label} ===`);
    this.write(`Started: ${new Date().toISOString()}`);
    this.write("");
  }

  /** Write to file only (no console output) */
  write(msg: string): void {
    appendFileSync(this.logPath, msg + "\n", "utf-8");
  }

  /** Write to both console and file */
  log(msg: string): void {
    console.log(msg);
    this.write(msg);
  }

  /** Write error to both console and file */
  error(msg: string): void {
    console.error(msg);
    this.write(`[ERROR] ${msg}`);
  }

  /** Record a generation attempt */
  recordAttempt(slug: string, lessonIndex: number | string, title: string, kind: "content" | "quiz" | "structure", success: boolean, elapsedMs: number): void {
    this.attempts++;
    if (!success) this.failures++;
    const status = success ? "SUCCESS" : "FAILED";
    const elapsed = (elapsedMs / 1000).toFixed(1);
    const line = `[ATTEMPT #${this.attempts}] ${slug} lesson:${lessonIndex} "${title}" — ${kind} — ${status} (${elapsed}s)`;
    this.write(line);
    if (!success) {
      console.log(`  ${line}`);
    }
  }

  /** Print summary to both console and file */
  summary(results: Array<{ slug: string; success: boolean; lessons: number; error?: string }>): void {
    const lines = [
      "",
      "═".repeat(60),
      "SUMMARY",
      "═".repeat(60),
    ];

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const totalLessons = results.reduce((sum, r) => sum + r.lessons, 0);

    for (const r of results) {
      const status = r.success ? "OK" : "FAILED";
      lines.push(`  ${status.padEnd(7)} ${r.slug} (${r.lessons} lessons${r.error ? `, error: ${r.error}` : ""})`);
    }

    lines.push("");
    lines.push(`Courses: ${successful.length} succeeded, ${failed.length} failed`);
    lines.push(`Lessons generated: ${totalLessons}`);
    lines.push(`Total API calls: ${this.attempts} (${this.failures} failures)`);
    lines.push(`Log file: ${this.logPath}`);

    for (const line of lines) {
      this.log(line);
    }
  }

  get path(): string {
    return this.logPath;
  }
}

// ─── CLI Parsing ─────────────────────────────────────────────────────────────

interface CliOptions {
  inputFile: string;
  defaultModel: string;
  concurrency: number;
  dryRun: boolean;
  resume: boolean;
  courseSlug: string | null;
  userEmail: string | null;
  phaseLog: string | null;
  phaseName: string | null;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = {
    inputFile: join(ROOT, "scripts", "gallery-courses.json"),
    defaultModel: "claude-sonnet-4-5-20250929",
    concurrency: 3,
    dryRun: false,
    resume: true,
    courseSlug: null,
    userEmail: null,
    phaseLog: null,
    phaseName: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--input":
        opts.inputFile = resolve(args[++i]);
        break;
      case "--model":
        opts.defaultModel = args[++i];
        break;
      case "--concurrency":
        opts.concurrency = parseInt(args[++i], 10);
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--no-resume":
        opts.resume = false;
        break;
      case "--course":
        opts.courseSlug = args[++i];
        break;
      case "--user":
        opts.userEmail = args[++i];
        break;
      case "--phase-log":
        opts.phaseLog = resolve(args[++i]);
        break;
      case "--phase-name":
        opts.phaseName = args[++i];
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  return opts;
}

// ─── State File ──────────────────────────────────────────────────────────────

interface LessonState {
  lessonId: string;
  contentDone: boolean;
  quizDone: boolean;
}

interface CourseState {
  slug: string;
  courseId: string | null;
  structureDone: boolean;
  lessons: Record<string, LessonState>; // keyed by orderIndex
  galleryDone: boolean;
}

interface SeedState {
  courses: Record<string, CourseState>; // keyed by slug
}

function loadState(): SeedState {
  if (existsSync(STATE_FILE)) {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  }
  return { courses: {} };
}

function saveState(state: SeedState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function getCourseState(state: SeedState, slug: string): CourseState {
  if (!state.courses[slug]) {
    state.courses[slug] = {
      slug,
      courseId: null,
      structureDone: false,
      lessons: {},
      galleryDone: false,
    };
  }
  return state.courses[slug];
}

// ─── Course Spec ─────────────────────────────────────────────────────────────

interface CourseSpec {
  slug: string;
  topic: string;
  description: string;
  focusAreas: string[];
  lessonCount: number;
  difficulty: string;
  language: string;
  model?: string;
  galleryTags?: string[];
}

// ─── Turso Direct DB ─────────────────────────────────────────────────────────

function tursoBaseUrl(env: Record<string, string>): string {
  return env.TURSO_DATABASE_URL.replace("libsql://", "https://");
}

interface TursoValue {
  type: string;
  value: string | null;
}

interface TursoRow {
  [index: number]: TursoValue;
}

interface TursoResult {
  type: string;
  response?: { result: { rows: TursoRow[]; columns: string[] } };
  error?: { message: string };
}

async function tursoExec(env: Record<string, string>, statements: Array<{ sql: string; args?: unknown[] }>): Promise<TursoResult[]> {
  const requests = statements.map((s) => ({
    type: "execute" as const,
    stmt: s.args
      ? { sql: s.sql, args: s.args.map((a) => ({ type: inferType(a), value: formatValue(a) })) }
      : { sql: s.sql },
  }));

  const body = JSON.stringify({ requests });
  const maxRetries = 5;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`${tursoBaseUrl(env)}/v2/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.TURSO_AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (res.ok) {
      return (await res.json()).results as TursoResult[];
    }

    const text = await res.text();

    // Retry on 502/503/504 (transient Turso errors)
    if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxRetries) {
      const delay = Math.min(2000 * Math.pow(2, attempt), 60_000);
      console.log(`  [turso] ${res.status} error, retrying in ${(delay / 1000).toFixed(0)}s (${attempt + 1}/${maxRetries})...`);
      await sleep(delay);
      continue;
    }

    throw new Error(`Turso API ${res.status}: ${text}`);
  }

  throw new Error("Turso API: max retries exceeded");
}

function inferType(val: unknown): string {
  if (val === null) return "null";
  if (typeof val === "number") return Number.isInteger(val) ? "integer" : "float";
  if (typeof val === "boolean") return "integer";
  return "text";
}

function formatValue(val: unknown): string | number | null {
  if (val === null) return null;
  // Turso HTTP API: integer values as strings, float values as numbers
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val;
  if (typeof val === "boolean") return val ? "1" : "0";
  return String(val);
}

async function tursoQuery(env: Record<string, string>, sql: string, args?: unknown[]): Promise<{ rows: TursoRow[]; columns: string[] }> {
  const results = await tursoExec(env, [{ sql, args }]);
  const r = results[0];
  if (r.type === "error") {
    throw new Error(`SQL error: ${r.error?.message || JSON.stringify(r.error)}`);
  }
  return r.response!.result;
}

async function tursoInsert(env: Record<string, string>, sql: string, args?: unknown[]): Promise<void> {
  const results = await tursoExec(env, [{ sql, args }]);
  const r = results[0];
  if (r.type === "error") {
    throw new Error(`SQL insert error: ${r.error?.message || JSON.stringify(r.error)}`);
  }
}

// ─── CUID Generation ─────────────────────────────────────────────────────────
// Simplified cuid-like IDs for DB records

function cuid(): string {
  const timestamp = Date.now().toString(36);
  const random = randomUUID().replace(/-/g, "").slice(0, 16);
  return `c${timestamp}${random}`;
}

// ─── AI Generation ───────────────────────────────────────────────────────────

// Dynamic imports since these use @/ path aliases resolved by tsx
async function loadAiModules() {
  const { getModelInstance, getProviderOptions, createRepairFunction, createRepairTracker } =
    await import("../src/lib/ai/client.js");
  const { courseStructureSchema } = await import("../src/lib/ai/schemas/courseSchema.js");
  const { lessonContentSchema } = await import("../src/lib/ai/schemas/lessonSchema.js");
  const { quizSchema } = await import("../src/lib/ai/schemas/quizSchema.js");
  const { buildCourseStructurePrompt } = await import("../src/lib/ai/prompts/courseStructure.js");
  const { buildQuizPrompt } = await import("../src/lib/ai/prompts/quizGeneration.js");
  const { buildLanguageInstruction } = await import("../src/lib/ai/prompts/languageInstruction.js");
  const { tryCoerceAndValidate, unwrapParameter, getCheapestModel, repackWithAI } =
    await import("../src/lib/ai/repairSchema.js");
  const { validateAndRepairVisualizations } = await import("../src/lib/content/vizValidation.js");
  const { generateObject, NoObjectGeneratedError } = await import("ai");

  return {
    getModelInstance,
    getProviderOptions,
    createRepairFunction,
    createRepairTracker,
    courseStructureSchema,
    lessonContentSchema,
    quizSchema,
    buildCourseStructurePrompt,
    buildQuizPrompt,
    buildLanguageInstruction,
    tryCoerceAndValidate,
    unwrapParameter,
    getCheapestModel,
    repackWithAI,
    validateAndRepairVisualizations,
    generateObject,
    NoObjectGeneratedError,
  };
}

type AiModules = Awaited<ReturnType<typeof loadAiModules>>;

import type { ProviderApiKeys } from "../src/lib/ai/client.js";
import type { CourseStructureOutput } from "../src/lib/ai/schemas/courseSchema.js";
import type { LessonContentOutput } from "../src/lib/ai/schemas/lessonSchema.js";
import type { QuizOutput } from "../src/lib/ai/schemas/quizSchema.js";
import type { WrapperType } from "../src/lib/ai/repairSchema.js";

// ─── Three-layer AI generation ──────────────────────────────────────────────

async function generateWithRepair<T>(
  ai: AiModules,
  opts: {
    modelId: string;
    apiKeys: ProviderApiKeys;
    schema: import("zod").ZodType<T>;
    prompt: string;
    label: string;
  }
): Promise<T> {
  const { modelId, apiKeys, schema, prompt, label } = opts;
  const modelInstance = ai.getModelInstance(modelId, apiKeys);
  const tracker = ai.createRepairTracker();

  const t0 = Date.now();

  // Layer 0
  try {
    const { object } = await ai.generateObject({
      model: modelInstance,
      schema,
      prompt,
      providerOptions: ai.getProviderOptions(modelId),
      experimental_repairText: ai.createRepairFunction(schema, tracker),
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  [${label}] Generated in ${elapsed}s (layer 0${tracker.repairCalled ? " + repair" : ""})`);
    return object;
  } catch (genErr) {
    if (!ai.NoObjectGeneratedError.isInstance(genErr) || !genErr.text) {
      throw genErr;
    }

    console.log(`  [${label}] Layer 0 failed, trying layer 1...`);

    // Layer 1 — direct coercion
    try {
      const parsed = JSON.parse(genErr.text);
      const { unwrapped: target } = ai.unwrapParameter(parsed);
      const coerced = ai.tryCoerceAndValidate(target, schema);
      if (coerced) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  [${label}] Recovered via layer 1 in ${elapsed}s`);
        return coerced;
      }
    } catch { /* not valid JSON */ }

    // Layer 2 — AI repack
    const cheapModel = ai.getCheapestModel(apiKeys);
    if (cheapModel) {
      console.log(`  [${label}] Trying layer 2 (AI repack with ${cheapModel})...`);
      const repacked = await ai.repackWithAI(genErr.text, schema, apiKeys, cheapModel);
      if (repacked) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  [${label}] Recovered via layer 2 in ${elapsed}s`);
        return repacked;
      }
    }

    throw new Error(`[${label}] All repair layers failed`);
  }
}

// ─── Exponential Backoff ─────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; label: string; logger?: FileLogger; slug?: string; lessonIndex?: number | string; title?: string; kind?: "content" | "quiz" | "structure" }
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 3;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const t0 = Date.now();
    try {
      const result = await fn();
      // Record successful attempt
      if (opts.logger && opts.kind) {
        opts.logger.recordAttempt(opts.slug ?? "", opts.lessonIndex ?? "-", opts.title ?? opts.label, opts.kind, true, Date.now() - t0);
      }
      return result;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);

      // Record failed attempt
      if (opts.logger && opts.kind) {
        opts.logger.recordAttempt(opts.slug ?? "", opts.lessonIndex ?? "-", opts.title ?? opts.label, opts.kind, false, Date.now() - t0);
      }

      // Detect rate limit (429)
      if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
        const delay = Math.min(1000 * Math.pow(2, attempt + 2), 120_000); // 4s, 8s, 16s, 32s...
        console.log(`  [${opts.label}] Rate limited. Waiting ${(delay / 1000).toFixed(0)}s before retry ${attempt + 1}/${maxRetries}...`);
        await sleep(delay);
        continue;
      }

      // Detect overloaded (529)
      if (msg.includes("529") || msg.toLowerCase().includes("overloaded")) {
        const delay = Math.min(1000 * Math.pow(2, attempt + 3), 180_000); // 8s, 16s, 32s...
        console.log(`  [${opts.label}] Provider overloaded. Waiting ${(delay / 1000).toFixed(0)}s before retry ${attempt + 1}/${maxRetries}...`);
        await sleep(delay);
        continue;
      }

      // Non-retryable error
      if (attempt < maxRetries) {
        const delay = 2000 * (attempt + 1);
        console.log(`  [${opts.label}] Error: ${msg}. Retry ${attempt + 1}/${maxRetries} in ${(delay / 1000).toFixed(0)}s...`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Concurrency Limiter ─────────────────────────────────────────────────────

class Semaphore {
  private queue: Array<() => void> = [];
  private current = 0;

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) {
      this.current++;
      next();
    }
  }
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

async function findOrCreateAdminUser(env: Record<string, string>): Promise<string> {
  // Look for existing admin user
  const result = await tursoQuery(env, `SELECT id FROM "User" WHERE role = 'admin' LIMIT 1`);
  if (result.rows.length > 0) {
    return result.rows[0][0].value!;
  }

  // Look for existing owner
  const ownerResult = await tursoQuery(env, `SELECT id FROM "User" WHERE role = 'owner' LIMIT 1`);
  if (ownerResult.rows.length > 0) {
    return ownerResult.rows[0][0].value!;
  }

  // Fallback: create a system admin user
  const id = cuid();
  const now = new Date().toISOString();
  await tursoInsert(
    env,
    `INSERT INTO "User" (id, name, email, role, "accessStatus", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, "Gallery Seed Bot", "seed-bot@system.local", "admin", "active", now, now]
  );
  console.log(`  Created system admin user: ${id}`);
  return id;
}

async function findUserByEmail(env: Record<string, string>, email: string): Promise<string> {
  const result = await tursoQuery(env, `SELECT id, name, role FROM "User" WHERE email = ? LIMIT 1`, [email]);
  if (result.rows.length === 0) {
    throw new Error(`No user found with email: ${email}`);
  }
  const id = result.rows[0][0].value!;
  const name = result.rows[0][1].value ?? "(no name)";
  const role = result.rows[0][2].value ?? "user";
  console.log(`  Found user: ${name} (${role}) — ${id}`);
  return id;
}

async function generateCourseStructure(
  ai: AiModules,
  spec: CourseSpec,
  modelId: string,
  apiKeys: ProviderApiKeys,
  logger: FileLogger,
): Promise<CourseStructureOutput> {
  const prompt = ai.buildCourseStructurePrompt({
    topic: spec.topic,
    description: spec.description,
    focusAreas: spec.focusAreas,
    lessonCount: spec.lessonCount,
    difficulty: spec.difficulty,
    language: spec.language,
  });

  return withRetry(
    () => generateWithRepair(ai, {
      modelId,
      apiKeys,
      schema: ai.courseStructureSchema,
      prompt,
      label: `${spec.slug}/structure`,
    }),
    { label: `${spec.slug}/structure`, logger, slug: spec.slug, lessonIndex: "-", title: spec.slug, kind: "structure" }
  );
}

async function generateLessonContent(
  ai: AiModules,
  opts: {
    slug: string;
    lessonTitle: string;
    lessonSummary: string;
    courseTopic: string;
    courseTitle: string;
    difficulty: string;
    focusAreas: string[];
    language: string;
    contextDoc: string;
    prerequisiteSummaries: string;
    modelId: string;
    apiKeys: ProviderApiKeys;
    logger: FileLogger;
    lessonIndex: number;
  }
): Promise<LessonContentOutput> {
  const languageInstruction = ai.buildLanguageInstruction(opts.language);

  const prompt = `You are an educator specializing in ${opts.courseTopic}, creating a detailed lesson.

LESSON: ${opts.lessonTitle}
SUMMARY: ${opts.lessonSummary}
COURSE: ${opts.courseTitle} - ${opts.courseTopic}
DIFFICULTY: ${opts.difficulty}
FOCUS AREAS: ${opts.focusAreas.join(", ") || "General coverage"}

${opts.prerequisiteSummaries ? `PREREQUISITES COMPLETED:\n${opts.prerequisiteSummaries}` : "This is a starting lesson with no prerequisites."}
${opts.contextDoc ? `\nCOURSE CONTEXT DOCUMENT:\n${opts.contextDoc}\n\nFollow the notation conventions, pedagogical approach, and style guidelines above when generating this lesson.\n` : ""}

LESSON CONTENT GUIDELINES:
1. Use Markdown with LaTeX for all mathematical notation.
   - Inline math: $...$
   - Display math: $$...$$
2. Build intuition BEFORE formalism. Start with a motivating example or real-world connection, then introduce formal definitions.
3. Include at least ONE visualization section. Use JavaScript Math syntax (Math.sin, Math.pow, etc.) for expressions. IMPORTANT: function_plot only supports single-variable functions of x (e.g. Math.pow(x,2)). For 2D vector fields F(x,y), use vector_field with fieldFunction: '[dx_expr, dy_expr]'. For surfaces z=f(u,v), use 3d_surface.
4. Include at least ONE worked example with detailed step-by-step solution.
5. Include at least TWO practice exercises with hints and solutions.
6. For practice exercises: mirror the worked example pattern but change the specific values.
7. Aim for 8-15 sections of varied types (text, math, definition, theorem, visualization).
8. Make the content thorough but accessible - explain the "why" not just the "what".
9. For tabular data (payoff matrices, truth tables, comparisons), use Markdown pipe-table syntax. Use only inline math $...$ inside table cells — never display math $$...$$.${languageInstruction}`;

  const content = await withRetry(
    () => generateWithRepair(ai, {
      modelId: opts.modelId,
      apiKeys: opts.apiKeys,
      schema: ai.lessonContentSchema,
      prompt,
      label: `${opts.slug}/lesson:${opts.lessonTitle}`,
    }),
    { label: `${opts.slug}/lesson:${opts.lessonTitle}`, logger: opts.logger, slug: opts.slug, lessonIndex: opts.lessonIndex, title: opts.lessonTitle, kind: "content" }
  );

  // Validate visualizations
  if (content.sections) {
    for (const section of content.sections) {
      if (section.type === "visualization" && typeof section.spec === "string") {
        try {
          (section as Record<string, unknown>).spec = JSON.parse(section.spec as string);
        } catch { /* keep as-is */ }
      }
    }
    const vizResult = ai.validateAndRepairVisualizations(
      content.sections as Array<{ type: string; vizType?: string; spec?: unknown }>
    );
    content.sections = vizResult.sections as typeof content.sections;
    if (vizResult.warnings.length > 0) {
      console.log(`    Viz warnings: ${vizResult.warnings.join("; ")}`);
    }
  }

  if (!content.sections?.length) {
    throw new Error("Lesson generation produced empty sections");
  }

  return content;
}

async function generateQuizContent(
  ai: AiModules,
  opts: {
    slug: string;
    lessonTitle: string;
    lessonSummary: string;
    courseTopic: string;
    difficulty: string;
    language: string;
    lessonContent: LessonContentOutput;
    modelId: string;
    apiKeys: ProviderApiKeys;
    logger: FileLogger;
    lessonIndex: number;
  }
): Promise<QuizOutput> {
  const prompt = ai.buildQuizPrompt({
    lessonTitle: opts.lessonTitle,
    lessonSummary: opts.lessonSummary,
    courseTopic: opts.courseTopic,
    difficulty: opts.difficulty,
    lessonContent: opts.lessonContent,
    language: opts.language,
  });

  return withRetry(
    () => generateWithRepair(ai, {
      modelId: opts.modelId,
      apiKeys: opts.apiKeys,
      schema: ai.quizSchema,
      prompt,
      label: `${opts.slug}/quiz:${opts.lessonTitle}`,
    }),
    { label: `${opts.slug}/quiz:${opts.lessonTitle}`, logger: opts.logger, slug: opts.slug, lessonIndex: opts.lessonIndex, title: opts.lessonTitle, kind: "quiz" }
  );
}

// ─── DB Operations ───────────────────────────────────────────────────────────

async function createCourse(
  env: Record<string, string>,
  userId: string,
  spec: CourseSpec,
  structure: CourseStructureOutput,
): Promise<{ courseId: string; lessonMap: Map<number, string> }> {
  const courseId = cuid();
  const now = new Date().toISOString();
  const subjects = JSON.stringify(structure.subjects);
  const focusAreas = JSON.stringify(spec.focusAreas);

  await tursoInsert(
    env,
    `INSERT INTO "Course" (id, "userId", title, description, topic, subject, "focusAreas", "targetLessonCount", difficulty, language, "contextDoc", status, "createdAt", "updatedAt")
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [courseId, userId, structure.title, structure.description, spec.topic, subjects, focusAreas, spec.lessonCount, spec.difficulty, spec.language, structure.contextDoc, "ready", now, now]
  );

  // Create lessons
  const lessonMap = new Map<number, string>();
  for (const lesson of structure.lessons) {
    const lessonId = cuid();
    lessonMap.set(lesson.orderIndex, lessonId);

    await tursoInsert(
      env,
      `INSERT INTO "Lesson" (id, "courseId", title, summary, "orderIndex", weight, status, "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [lessonId, courseId, lesson.title, lesson.summary, lesson.orderIndex, lesson.weight ?? 1.0, "pending", now, now]
    );
  }

  // Create edges
  for (const edge of structure.edges) {
    const fromId = lessonMap.get(edge.from);
    const toId = lessonMap.get(edge.to);
    if (fromId && toId) {
      const edgeId = cuid();
      await tursoInsert(
        env,
        `INSERT INTO "CourseEdge" (id, "courseId", "fromLessonId", "toLessonId", relationship)
         VALUES (?, ?, ?, ?, ?)`,
        [edgeId, courseId, fromId, toId, edge.relationship]
      );
    }
  }

  return { courseId, lessonMap };
}

async function saveLessonContent(
  env: Record<string, string>,
  lessonId: string,
  content: LessonContentOutput,
): Promise<void> {
  const now = new Date().toISOString();
  await tursoInsert(
    env,
    `UPDATE "Lesson" SET "contentJson" = ?, status = 'ready', "updatedAt" = ? WHERE id = ?`,
    [JSON.stringify(content), now, lessonId]
  );
}

async function saveQuiz(
  env: Record<string, string>,
  lessonId: string,
  quiz: QuizOutput,
): Promise<void> {
  const quizId = cuid();
  const now = new Date().toISOString();
  await tursoInsert(
    env,
    `INSERT INTO "Quiz" (id, "lessonId", "questionsJson", "questionCount", status, generation, "isActive", "createdAt")
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [quizId, lessonId, JSON.stringify(quiz.questions), quiz.questions.length, "ready", 1, 1, now]
  );
}

async function createGalleryListing(
  env: Record<string, string>,
  courseId: string,
  spec: CourseSpec,
  structure: CourseStructureOutput,
): Promise<string> {
  const shareId = cuid();
  const shareToken = randomUUID();
  const now = new Date().toISOString();
  const tags = JSON.stringify(spec.galleryTags ?? []);

  // Find a good preview lesson (first non-zero orderIndex with content)
  const previewResult = await tursoQuery(
    env,
    `SELECT id FROM "Lesson" WHERE "courseId" = ? AND "contentJson" IS NOT NULL ORDER BY "orderIndex" LIMIT 1`,
    [courseId]
  );
  const previewLessonId = previewResult.rows.length > 0 ? previewResult.rows[0][0].value : null;

  await tursoInsert(
    env,
    `INSERT INTO "CourseShare" (id, "courseId", "shareToken", "isActive", "isGalleryListed", "galleryTitle", "galleryDescription", tags, "previewLessonId", "createdAt")
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [shareId, courseId, shareToken, 1, 1, structure.title, structure.description, tags, previewLessonId, now]
  );

  return shareToken;
}

// ─── Main Pipeline ───────────────────────────────────────────────────────────

async function seedCourse(
  env: Record<string, string>,
  ai: AiModules,
  spec: CourseSpec,
  opts: CliOptions,
  apiKeys: ProviderApiKeys,
  userId: string,
  state: SeedState,
  logger: FileLogger,
): Promise<{ success: boolean; lessonsGenerated: number; error?: string }> {
  const cs = getCourseState(state, spec.slug);
  const modelId = spec.model || opts.defaultModel;
  let lessonsGenerated = 0;

  logger.log(`\n${"═".repeat(60)}`);
  logger.log(`Course: ${spec.topic} (${spec.slug})`);
  logger.log(`Model: ${modelId} | Lessons: ${spec.lessonCount} | Lang: ${spec.language}`);
  logger.log(`${"═".repeat(60)}`);

  // Step 1: Generate course structure
  let structure: CourseStructureOutput;
  let courseId = cs.courseId;
  let lessonMap: Map<number, string>;

  if (cs.structureDone && cs.courseId && opts.resume) {
    logger.log(`  [structure] Already done, resuming...`);
    // Reconstruct lessonMap from DB
    const result = await tursoQuery(
      env,
      `SELECT id, "orderIndex" FROM "Lesson" WHERE "courseId" = ? ORDER BY "orderIndex"`,
      [cs.courseId]
    );
    lessonMap = new Map(result.rows.map((r) => [parseInt(r[1].value!, 10), r[0].value!]));

    // Fetch the course structure for lesson generation context
    const courseResult = await tursoQuery(
      env,
      `SELECT title, description, "contextDoc", topic FROM "Course" WHERE id = ?`,
      [cs.courseId]
    );
    const row = courseResult.rows[0];
    // Build a minimal structure for lesson gen
    const lessonResult = await tursoQuery(
      env,
      `SELECT title, summary, "orderIndex" FROM "Lesson" WHERE "courseId" = ? ORDER BY "orderIndex"`,
      [cs.courseId]
    );
    structure = {
      title: row[0].value!,
      description: row[1].value!,
      contextDoc: row[2].value ?? "",
      subjects: [],
      suggestedLessonCount: spec.lessonCount,
      lessons: lessonResult.rows.map((r) => ({
        title: r[0].value!,
        summary: r[1].value!,
        orderIndex: parseInt(r[2].value!, 10),
        prerequisites: [],
        keyTopics: [],
        estimatedDifficulty: "intermediate" as const,
        weight: 1.0,
      })),
      edges: [],
    };
  } else {
    logger.log(`  [structure] Generating course structure...`);

    if (opts.dryRun) {
      logger.log(`  [dry-run] Would generate structure with ${spec.lessonCount} lessons`);
      return { success: true, lessonsGenerated: 0 };
    }

    structure = await generateCourseStructure(ai, spec, modelId, apiKeys, logger);
    logger.log(`  [structure] Generated: "${structure.title}" with ${structure.lessons.length} lessons`);

    // Save to DB
    const result = await createCourse(env, userId, spec, structure);
    courseId = result.courseId;
    lessonMap = result.lessonMap;

    cs.courseId = courseId;
    cs.structureDone = true;
    saveState(state);
  }

  // Step 2: Generate lessons with concurrency
  const sem = new Semaphore(opts.concurrency);
  const errors: string[] = [];

  // Build prerequisite map for context
  const lessonByIndex = new Map(structure.lessons.map((l) => [l.orderIndex, l]));

  // Sort lessons topologically (by orderIndex for simplicity — DAG guarantees lower index prerequisites)
  const sortedLessons = [...structure.lessons].sort((a, b) => a.orderIndex - b.orderIndex);

  // For each lesson, generate content + quiz
  const lessonPromises = sortedLessons.map(async (lesson) => {
    const lessonId = lessonMap.get(lesson.orderIndex);
    if (!lessonId) {
      logger.log(`  [lesson:${lesson.orderIndex}] No lesson ID found, skipping`);
      return;
    }

    const lKey = String(lesson.orderIndex);
    if (!cs.lessons[lKey]) {
      cs.lessons[lKey] = { lessonId, contentDone: false, quizDone: false };
    }
    const ls = cs.lessons[lKey];

    // Skip if fully done
    if (ls.contentDone && ls.quizDone && opts.resume) {
      logger.log(`  [lesson:${lesson.orderIndex}] "${lesson.title}" — already done`);
      return;
    }

    await sem.acquire();
    try {
      // Build prerequisite summaries
      const prereqs = structure.edges
        .filter((e) => e.to === lesson.orderIndex)
        .map((e) => lessonByIndex.get(e.from))
        .filter(Boolean)
        .map((p) => `- ${p!.title}: ${p!.summary}`)
        .join("\n");

      // Generate lesson content
      if (!ls.contentDone || !opts.resume) {
        if (opts.dryRun) {
          logger.log(`  [dry-run] Would generate lesson: "${lesson.title}"`);
          return;
        }

        logger.log(`  [lesson:${lesson.orderIndex}] Generating "${lesson.title}"...`);
        const content = await generateLessonContent(ai, {
          slug: spec.slug,
          lessonTitle: lesson.title,
          lessonSummary: lesson.summary,
          courseTopic: spec.topic,
          courseTitle: structure.title,
          difficulty: spec.difficulty,
          focusAreas: spec.focusAreas,
          language: spec.language,
          contextDoc: structure.contextDoc,
          prerequisiteSummaries: prereqs,
          modelId,
          apiKeys,
          logger,
          lessonIndex: lesson.orderIndex,
        });

        await saveLessonContent(env, lessonId, content);
        ls.contentDone = true;
        saveState(state);
        lessonsGenerated++;

        // Generate quiz
        if (!ls.quizDone || !opts.resume) {
          logger.log(`  [quiz:${lesson.orderIndex}] Generating quiz for "${lesson.title}"...`);
          const quiz = await generateQuizContent(ai, {
            slug: spec.slug,
            lessonTitle: lesson.title,
            lessonSummary: lesson.summary,
            courseTopic: spec.topic,
            difficulty: spec.difficulty,
            language: spec.language,
            lessonContent: content,
            modelId,
            apiKeys,
            logger,
            lessonIndex: lesson.orderIndex,
          });

          await saveQuiz(env, lessonId, quiz);
          ls.quizDone = true;
          saveState(state);
        }
      } else if (!ls.quizDone || !opts.resume) {
        // Content done but quiz isn't
        if (opts.dryRun) {
          logger.log(`  [dry-run] Would generate quiz for: "${lesson.title}"`);
          return;
        }

        // Fetch existing content for quiz generation context
        const contentResult = await tursoQuery(
          env,
          `SELECT "contentJson" FROM "Lesson" WHERE id = ?`,
          [lessonId]
        );
        const contentJson = contentResult.rows[0]?.[0]?.value;
        const existingContent = contentJson ? JSON.parse(contentJson) : undefined;

        logger.log(`  [quiz:${lesson.orderIndex}] Generating quiz for "${lesson.title}"...`);
        const quiz = await generateQuizContent(ai, {
          slug: spec.slug,
          lessonTitle: lesson.title,
          lessonSummary: lesson.summary,
          courseTopic: spec.topic,
          difficulty: spec.difficulty,
          language: spec.language,
          lessonContent: existingContent,
          modelId,
          apiKeys,
          logger,
          lessonIndex: lesson.orderIndex,
        });

        await saveQuiz(env, lessonId, quiz);
        ls.quizDone = true;
        saveState(state);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`  [lesson:${lesson.orderIndex}] FAILED: ${msg}`);
      errors.push(`${lesson.title}: ${msg}`);
    } finally {
      sem.release();
    }
  });

  await Promise.all(lessonPromises);

  // Step 3: Create gallery listing
  if (!cs.galleryDone && errors.length === 0) {
    if (opts.dryRun) {
      logger.log(`  [dry-run] Would create gallery listing with tags: ${spec.galleryTags?.join(", ")}`);
    } else {
      const shareToken = await createGalleryListing(env, courseId!, spec, structure);
      logger.log(`  [gallery] Listed! Share token: ${shareToken}`);
      cs.galleryDone = true;
      saveState(state);
    }
  } else if (errors.length > 0) {
    logger.log(`  [gallery] Skipped — ${errors.length} lesson error(s). Fix and re-run to complete.`);
  }

  if (errors.length > 0) {
    return { success: false, lessonsGenerated, error: `${errors.length} lesson(s) failed` };
  }

  return { success: true, lessonsGenerated };
}

// ─── Phase Log Update ────────────────────────────────────────────────────────

function updatePhaseLog(
  phaseLogPath: string,
  phaseName: string,
  results: Array<{ slug: string; success: boolean; lessons: number; error?: string }>,
  logger: FileLogger,
): void {
  if (!existsSync(phaseLogPath)) {
    logger.error(`Phase log file not found: ${phaseLogPath}`);
    return;
  }

  const log = JSON.parse(readFileSync(phaseLogPath, "utf-8"));
  const phase = log.phases?.[phaseName];
  if (!phase) {
    logger.error(`Phase "${phaseName}" not found in generation log`);
    return;
  }

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const totalLessons = results.reduce((sum, r) => sum + r.lessons, 0);

  phase.coursesCompleted = successful.map((r) => r.slug);
  phase.coursesFailed = failed.map((r) => r.slug);
  phase.totalLessons = totalLessons;
  phase.totalAttempts = logger.attempts;
  phase.totalFailures = logger.failures;
  phase.completedAt = new Date().toISOString();
  phase.status = failed.length === 0 ? "completed" : "partial";

  writeFileSync(phaseLogPath, JSON.stringify(log, null, 2) + "\n", "utf-8");
  logger.log(`\nPhase log updated: ${phaseLogPath}`);
  logger.log(`  Remember to manually update "${phaseName}.startBalance" and "${phaseName}.endBalance" from Anthropic dashboard.`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const env = loadEnvSecret();

  // Validate required env vars
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
    console.error("ERROR: .env.secret must define TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
    process.exit(1);
  }

  // Build API keys from env
  const apiKeys: ProviderApiKeys = {
    anthropic: env.ANTHROPIC_API_KEY || undefined,
    openai: env.OPENAI_API_KEY || undefined,
    google: env.GOOGLE_AI_API_KEY || undefined,
  };

  const hasKeys = Boolean(apiKeys.anthropic || apiKeys.openai || apiKeys.google);
  if (!hasKeys && !opts.dryRun) {
    console.error("ERROR: No AI provider API keys found in .env.secret.");
    console.error("Set at least one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_AI_API_KEY");
    process.exit(1);
  }

  // Load course specs
  if (!existsSync(opts.inputFile)) {
    console.error(`ERROR: Input file not found: ${opts.inputFile}`);
    process.exit(1);
  }
  const allSpecs: CourseSpec[] = JSON.parse(readFileSync(opts.inputFile, "utf-8"));

  // Filter by slug if specified
  const specs = opts.courseSlug
    ? allSpecs.filter((s) => s.slug === opts.courseSlug)
    : allSpecs;

  if (specs.length === 0) {
    if (opts.courseSlug) {
      console.error(`ERROR: No course with slug "${opts.courseSlug}" found in ${opts.inputFile}`);
      const available = allSpecs.map((s) => s.slug).join(", ");
      console.error(`Available slugs: ${available}`);
    } else {
      console.error("ERROR: No course specs found in input file.");
    }
    process.exit(1);
  }

  // Create logger
  const logLabel = opts.phaseName ?? opts.courseSlug ?? "run";
  const logger = new FileLogger(logLabel);

  // Inject env vars so AI SDK modules can find them (they check process.env)
  process.env.ANTHROPIC_API_KEY = apiKeys.anthropic ?? "";
  process.env.OPENAI_API_KEY = apiKeys.openai ?? "";
  process.env.GOOGLE_AI_API_KEY = apiKeys.google ?? "";

  // Load AI modules
  logger.log("Loading AI modules...");
  const ai = await loadAiModules();

  const state = opts.resume ? loadState() : { courses: {} };

  logger.log(`\nGallery Seeder`);
  logger.log(`${"─".repeat(60)}`);
  logger.log(`Courses: ${specs.length}`);
  logger.log(`Model: ${opts.defaultModel}`);
  logger.log(`Concurrency: ${opts.concurrency}`);
  logger.log(`Resume: ${opts.resume}`);
  logger.log(`Dry run: ${opts.dryRun}`);
  if (opts.userEmail) logger.log(`User: ${opts.userEmail}`);
  if (opts.phaseName) logger.log(`Phase: ${opts.phaseName}`);
  logger.log(`Log file: ${logger.path}`);
  logger.log(`${"─".repeat(60)}`);

  if (opts.dryRun) {
    logger.log(`\n--- DRY RUN MODE ---\n`);
    for (const spec of specs) {
      const model = spec.model || opts.defaultModel;
      logger.log(`  ${spec.slug}:`);
      logger.log(`    Topic: ${spec.topic}`);
      logger.log(`    Description: ${spec.description}`);
      logger.log(`    Lessons: ${spec.lessonCount} | Difficulty: ${spec.difficulty} | Lang: ${spec.language}`);
      logger.log(`    Model: ${model}`);
      logger.log(`    Tags: ${spec.galleryTags?.join(", ") ?? "(none)"}`);
      logger.log("");
    }
    logger.log(`Total courses: ${specs.length}`);
    const totalLessons = specs.reduce((sum, s) => sum + s.lessonCount, 0);
    logger.log(`Total lessons (target): ${totalLessons}`);
    logger.log(`\nDry run complete — no AI calls or DB writes made.`);
    return;
  }

  // Find user
  let userId: string;
  if (opts.userEmail) {
    userId = await findUserByEmail(env, opts.userEmail);
  } else {
    userId = await findOrCreateAdminUser(env);
  }
  logger.log(`User: ${userId}`);

  // Process each course
  const results: Array<{ slug: string; success: boolean; lessons: number; error?: string }> = [];

  for (const spec of specs) {
    try {
      const result = await seedCourse(env, ai, spec, opts, apiKeys, userId, state, logger);
      results.push({ slug: spec.slug, success: result.success, lessons: result.lessonsGenerated, error: result.error });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`\nFATAL ERROR for ${spec.slug}: ${msg}`);
      results.push({ slug: spec.slug, success: false, lessons: 0, error: msg });
    }
  }

  // Summary
  logger.summary(results);

  const failed = results.filter((r) => !r.success);

  // Update phase log if configured
  if (opts.phaseLog && opts.phaseName) {
    updatePhaseLog(opts.phaseLog, opts.phaseName, results, logger);
  }

  if (failed.length > 0) {
    logger.log(`\nRe-run with --resume to complete failed courses.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\nFatal error: ${err instanceof Error ? err.message : err}`);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
