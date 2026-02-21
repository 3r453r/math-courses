#!/usr/bin/env tsx
/**
 * Course Library Import Script
 *
 * Reads CourseExportJson files from course-library/anthropic-json/ and
 * bulk-inserts courses into the target database.
 *
 * Usage:
 *   npx tsx scripts/import-course-library.mts [options]
 *
 * Options:
 *   --db <local|prod>      Target database (default: local)
 *   --file <slug>          Import only one specific course file (without .json)
 *   --dry-run              Preview — no DB writes
 *   --no-skip-existing     Re-import even if course topic already exists in DB
 *   --user <email>         Assign courses to this user (optional; defaults to admin)
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type InArgs } from "@libsql/client";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname!, "..");
const JSON_DIR = join(ROOT, "course-library", "anthropic-json");
const ENV_FILE = join(ROOT, ".env.secret");

// ─── CLI Parsing ─────────────────────────────────────────────────────────────

interface CliOptions {
  db: "local" | "prod";
  file: string | null;
  dryRun: boolean;
  skipExisting: boolean;
  userEmail: string | null;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = {
    db: "local",
    file: null,
    dryRun: false,
    skipExisting: true,
    userEmail: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--db":
        opts.db = args[++i] as "local" | "prod";
        break;
      case "--file":
        opts.file = args[++i];
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--no-skip-existing":
        opts.skipExisting = false;
        break;
      case "--user":
        opts.userEmail = args[++i];
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  if (opts.db !== "local" && opts.db !== "prod") {
    console.error(`Invalid --db value: ${opts.db}. Must be "local" or "prod".`);
    process.exit(1);
  }

  return opts;
}

// ─── Environment ─────────────────────────────────────────────────────────────

function loadEnvSecret(): Record<string, string> {
  if (!existsSync(ENV_FILE)) {
    console.error(`ERROR: ${ENV_FILE} not found.`);
    console.error("This file must contain TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
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

// ─── CUID Generation ─────────────────────────────────────────────────────────

function cuid(): string {
  const timestamp = Date.now().toString(36);
  const random = randomUUID().replace(/-/g, "").slice(0, 16);
  return `c${timestamp}${random}`;
}

// ─── DB Abstraction ───────────────────────────────────────────────────────────

interface Row {
  [key: string]: string | number | boolean | null | undefined;
}

interface DbClient {
  query(sql: string, args?: unknown[]): Promise<{ rows: Row[] }>;
  execute(sql: string, args?: unknown[]): Promise<void>;
  close?(): void;
}

// Local SQLite via @libsql/client
function createLocalDb(): DbClient {
  const dbPath = resolve(ROOT, "dev.db");
  if (!existsSync(dbPath)) {
    console.error(`ERROR: Local database not found at ${dbPath}`);
    console.error("Run 'pnpm dev' or 'npx prisma db push' to create it first.");
    process.exit(1);
  }
  const client = createClient({ url: `file:${dbPath}` });
  return {
    async query(sql, args) {
      const result = await client.execute({
        sql,
        args: (args ?? []) as InArgs,
      });
      return { rows: result.rows as unknown as Row[] };
    },
    async execute(sql, args) {
      await client.execute({
        sql,
        args: (args ?? []) as InArgs,
      });
    },
    close() {
      client.close();
    },
  };
}

// Turso HTTP API
interface TursoValue {
  type: string;
  value: string | number | null;
}

interface TursoRow {
  [index: number]: TursoValue;
}

interface TursoResult {
  type: string;
  response?: { result: { rows: TursoRow[]; columns: string[] } };
  error?: { message: string };
}

function tursoInferType(val: unknown): string {
  if (val === null) return "null";
  if (typeof val === "number") return Number.isInteger(val) ? "integer" : "float";
  if (typeof val === "boolean") return "integer";
  return "text";
}

function tursoFormatValue(val: unknown): string | number | null {
  if (val === null) return null;
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val;
  if (typeof val === "boolean") return val ? "1" : "0";
  return String(val);
}

async function tursoExec(
  env: Record<string, string>,
  statements: Array<{ sql: string; args?: unknown[] }>
): Promise<TursoResult[]> {
  const baseUrl = env.TURSO_DATABASE_URL.replace("libsql://", "https://");
  const requests = statements.map((s) => ({
    type: "execute" as const,
    stmt: s.args
      ? {
          sql: s.sql,
          args: s.args.map((a) => ({ type: tursoInferType(a), value: tursoFormatValue(a) })),
        }
      : { sql: s.sql },
  }));
  const body = JSON.stringify({ requests });

  for (let attempt = 0; attempt <= 5; attempt++) {
    const res = await fetch(`${baseUrl}/v2/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.TURSO_AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (res.ok) return (await res.json()).results as TursoResult[];
    const text = await res.text();
    if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < 5) {
      const delay = Math.min(2000 * Math.pow(2, attempt), 60_000);
      console.log(`  [turso] ${res.status} error, retrying in ${(delay / 1000).toFixed(0)}s...`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    throw new Error(`Turso API ${res.status}: ${text}`);
  }
  throw new Error("Turso API: max retries exceeded");
}

function createProdDb(env: Record<string, string>): DbClient {
  return {
    async query(sql, args) {
      const results = await tursoExec(env, [{ sql, args }]);
      const r = results[0];
      if (r.type === "error") {
        throw new Error(`SQL error: ${r.error?.message}`);
      }
      const { rows, columns } = r.response!.result;
      const parsed = rows.map((row) => {
        const obj: Row = {};
        columns.forEach((col, i) => {
          const v = row[i];
          if (v.type === "null") obj[col] = null;
          else if (v.type === "integer") obj[col] = parseInt(String(v.value));
          else if (v.type === "float") obj[col] = parseFloat(String(v.value));
          else obj[col] = v.value;
        });
        return obj;
      });
      return { rows: parsed };
    },
    async execute(sql, args) {
      const results = await tursoExec(env, [{ sql, args }]);
      const r = results[0];
      if (r.type === "error") {
        throw new Error(`SQL error: ${r.error?.message}`);
      }
    },
  };
}

// ─── JSON Format Types ────────────────────────────────────────────────────────

interface CourseJsonLesson {
  orderIndex: number;
  title: string;
  summary?: string | null;
  status: string;
  contentJson?: string | null;
  rawMarkdown?: string | null;
  isSupplementary?: boolean;
  weight?: number;
  completedAt?: string | null;
  quizzes?: Array<{
    questionsJson: string;
    questionCount: number;
    status: string;
    generation?: number;
    isActive?: boolean;
    attempts?: Array<{
      answersJson: string;
      score: number;
      weakTopics?: string | null;
      recommendation?: string | null;
      createdAt: string;
    }>;
  }>;
  notes?: Array<{
    title?: string | null;
    content: string;
    isScratchpad?: boolean;
    orderIndex?: number;
  }>;
  chatMessages?: Array<{
    role: string;
    content: string;
    createdAt: string;
  }>;
}

interface CourseJson {
  version: number;
  exportedAt?: string;
  course: {
    title: string;
    description?: string | null;
    topic: string;
    subject?: string | null;
    focusAreas?: string | null;
    targetLessonCount?: number;
    difficulty: string;
    language?: string;
    contextDoc?: string | null;
    passThreshold?: number;
    noLessonCanFail?: boolean;
    lessonFailureThreshold?: number;
    status: string;
  };
  lessons: CourseJsonLesson[];
  edges?: Array<{
    fromLessonIndex: number;
    toLessonIndex: number;
    relationship: string;
  }>;
  courseNotes?: Array<{
    title?: string | null;
    content: string;
    isScratchpad?: boolean;
    orderIndex?: number;
  }>;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateCourseJson(data: unknown, slug: string): CourseJson | null {
  if (typeof data !== "object" || data === null) {
    console.error(`  [${slug}] Invalid JSON: not an object`);
    return null;
  }
  const d = data as Record<string, unknown>;
  if (d.version !== 1) {
    console.error(`  [${slug}] Invalid version: expected 1, got ${d.version}`);
    return null;
  }
  if (typeof d.course !== "object" || d.course === null) {
    console.error(`  [${slug}] Missing course object`);
    return null;
  }
  if (!Array.isArray(d.lessons) || d.lessons.length === 0) {
    console.error(`  [${slug}] Missing or empty lessons array`);
    return null;
  }
  return data as CourseJson;
}

// ─── Subject Serialization ────────────────────────────────────────────────────

function serializeSubject(subject?: string | null): string {
  if (!subject) return '["Other"]';
  if (subject.startsWith("[")) return subject;
  return JSON.stringify([subject]);
}

// ─── Import Logic ─────────────────────────────────────────────────────────────

async function findOrCreateUser(
  db: DbClient,
  userEmail: string | null,
  dryRun: boolean
): Promise<string> {
  const now = new Date().toISOString();

  if (userEmail) {
    const { rows } = await db.query(
      `SELECT id FROM "User" WHERE email = ? LIMIT 1`,
      [userEmail]
    );
    if (rows.length === 0) {
      console.error(`ERROR: User with email "${userEmail}" not found in database.`);
      process.exit(1);
    }
    return String(rows[0].id);
  }

  // Find first admin
  const { rows: admins } = await db.query(
    `SELECT id FROM "User" WHERE role = 'admin' AND "accessStatus" = 'active' ORDER BY "createdAt" ASC LIMIT 1`,
    []
  );
  if (admins.length > 0) return String(admins[0].id);

  // Find any active user
  const { rows: activeUsers } = await db.query(
    `SELECT id FROM "User" WHERE "accessStatus" = 'active' ORDER BY "createdAt" ASC LIMIT 1`,
    []
  );
  if (activeUsers.length > 0) return String(activeUsers[0].id);

  // Create Library Bot user
  const botId = cuid();
  const botEmail = "library-bot@internal.local";
  if (!dryRun) {
    await db.execute(
      `INSERT OR IGNORE INTO "User" (id, name, email, role, "accessStatus", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [botId, "Library Bot", botEmail, "user", "active", now, now]
    );
    // Re-query in case INSERT was ignored (already exists)
    const { rows } = await db.query(
      `SELECT id FROM "User" WHERE email = ? LIMIT 1`,
      [botEmail]
    );
    if (rows.length > 0) return String(rows[0].id);
  } else {
    console.log(`  [dry-run] Would create Library Bot user: ${botEmail}`);
  }
  return botId;
}

async function courseExists(db: DbClient, userId: string, topic: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT id FROM "Course" WHERE "userId" = ? AND topic = ? LIMIT 1`,
    [userId, topic]
  );
  return rows.length > 0;
}

async function importCourse(
  db: DbClient,
  userId: string,
  data: CourseJson,
  slug: string,
  dryRun: boolean
): Promise<{ lessonCount: number }> {
  const now = new Date().toISOString();
  const { course: cd, lessons, edges, courseNotes } = data;

  if (dryRun) {
    console.log(
      `  [dry-run] Would import: "${cd.title}" (${lessons.length} lessons, ${(edges ?? []).length} edges)`
    );
    return { lessonCount: lessons.length };
  }

  // Create Course
  const courseId = cuid();
  await db.execute(
    `INSERT INTO "Course" (id, "userId", title, description, topic, subject, "focusAreas", "targetLessonCount", difficulty, language, "contextDoc", "passThreshold", "noLessonCanFail", "lessonFailureThreshold", status, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      courseId,
      userId,
      cd.title,
      cd.description ?? "",
      cd.topic,
      serializeSubject(cd.subject),
      cd.focusAreas ?? "[]",
      cd.targetLessonCount ?? lessons.length,
      cd.difficulty,
      cd.language ?? "en",
      cd.contextDoc ?? null,
      cd.passThreshold ?? 0.8,
      cd.noLessonCanFail ? 1 : 0,
      cd.lessonFailureThreshold ?? 0.5,
      cd.status,
      now,
      now,
    ]
  );

  // Create Lessons and build orderIndex → lessonId map
  const indexToId = new Map<number, string>();

  for (const ld of lessons) {
    const lessonId = cuid();
    indexToId.set(ld.orderIndex, lessonId);

    await db.execute(
      `INSERT INTO "Lesson" (id, "courseId", "orderIndex", title, summary, status, "contentJson", "rawMarkdown", "isSupplementary", weight, "completedAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lessonId,
        courseId,
        ld.orderIndex,
        ld.title,
        ld.summary ?? "",
        ld.status,
        ld.contentJson ?? null,
        ld.rawMarkdown ?? null,
        ld.isSupplementary ? 1 : 0,
        ld.weight ?? 1.0,
        ld.completedAt ?? null,
        now,
        now,
      ]
    );

    // Create quizzes
    for (const qd of ld.quizzes ?? []) {
      const quizId = cuid();
      await db.execute(
        `INSERT INTO "Quiz" (id, "lessonId", "questionsJson", "questionCount", status, generation, "isActive", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quizId,
          lessonId,
          qd.questionsJson,
          qd.questionCount,
          qd.status,
          qd.generation ?? 1,
          qd.isActive ? 1 : 0,
          now,
        ]
      );

      // Quiz attempts
      for (const ad of qd.attempts ?? []) {
        const attemptId = cuid();
        await db.execute(
          `INSERT INTO "QuizAttempt" (id, "quizId", "answersJson", score, "weakTopics", recommendation, "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            attemptId,
            quizId,
            ad.answersJson,
            ad.score,
            ad.weakTopics ?? "",
            ad.recommendation ?? "",
            ad.createdAt,
          ]
        );
      }
    }

    // Lesson notes
    for (const nd of ld.notes ?? []) {
      const noteId = cuid();
      await db.execute(
        `INSERT INTO "Note" (id, "lessonId", "courseId", title, content, "isScratchpad", "orderIndex", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          noteId,
          lessonId,
          courseId,
          nd.title ?? null,
          nd.content,
          nd.isScratchpad ? 1 : 0,
          nd.orderIndex ?? 0,
          now,
          now,
        ]
      );
    }

    // Chat messages
    for (const md of ld.chatMessages ?? []) {
      const msgId = cuid();
      await db.execute(
        `INSERT INTO "ChatMessage" (id, "lessonId", role, content, "createdAt") VALUES (?, ?, ?, ?, ?)`,
        [msgId, lessonId, md.role, md.content, md.createdAt]
      );
    }
  }

  // Create edges
  for (const ed of edges ?? []) {
    const fromId = indexToId.get(ed.fromLessonIndex);
    const toId = indexToId.get(ed.toLessonIndex);
    if (!fromId || !toId) {
      console.warn(
        `  [${slug}] Skipping edge ${ed.fromLessonIndex}→${ed.toLessonIndex}: lesson index not found`
      );
      continue;
    }
    const edgeId = cuid();
    await db.execute(
      `INSERT OR IGNORE INTO "CourseEdge" (id, "courseId", "fromLessonId", "toLessonId", relationship) VALUES (?, ?, ?, ?, ?)`,
      [edgeId, courseId, fromId, toId, ed.relationship]
    );
  }

  // Course-level notes
  for (const nd of courseNotes ?? []) {
    const noteId = cuid();
    await db.execute(
      `INSERT INTO "Note" (id, "courseId", title, content, "isScratchpad", "orderIndex", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        noteId,
        courseId,
        nd.title ?? null,
        nd.content,
        nd.isScratchpad ? 1 : 0,
        nd.orderIndex ?? 0,
        now,
        now,
      ]
    );
  }

  return { lessonCount: lessons.length };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface ImportResult {
  slug: string;
  status: "ok" | "skipped" | "failed";
  lessonCount: number;
  error?: string;
}

async function main() {
  const opts = parseArgs();

  // Gather JSON files
  if (!existsSync(JSON_DIR)) {
    console.error(`ERROR: Directory not found: ${JSON_DIR}`);
    process.exit(1);
  }

  let files: string[];
  if (opts.file) {
    const specificFile = join(JSON_DIR, `${opts.file}.json`);
    if (!existsSync(specificFile)) {
      console.error(`ERROR: File not found: ${specificFile}`);
      process.exit(1);
    }
    files = [`${opts.file}.json`];
  } else {
    files = readdirSync(JSON_DIR).filter((f) => f.endsWith(".json")).sort();
  }

  if (files.length === 0) {
    console.log("No JSON files found in course-library/anthropic-json/");
    process.exit(0);
  }

  // Create DB client
  let db: DbClient;
  if (opts.db === "prod") {
    console.log("⚠️  PRODUCTION MODE — connecting to Turso database");
    console.log("This will write to the production database. Ctrl-C to abort.");
    if (!opts.dryRun) {
      // 3-second pause to allow cancellation
      await new Promise((r) => setTimeout(r, 3000));
    }
    const env = loadEnvSecret();
    db = createProdDb(env);
  } else {
    db = createLocalDb();
  }

  // Find or create user
  const userId = await findOrCreateUser(db, opts.userEmail, opts.dryRun);
  if (!opts.dryRun) {
    console.log(`Using user ID: ${userId}`);
  }

  const results: ImportResult[] = [];

  for (const file of files) {
    const slug = file.replace(/\.json$/, "");
    const filePath = join(JSON_DIR, file);

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (e) {
      console.error(`  [${slug}] Failed to parse JSON: ${e}`);
      results.push({ slug, status: "failed", lessonCount: 0, error: "JSON parse error" });
      continue;
    }

    const data = validateCourseJson(raw, slug);
    if (!data) {
      results.push({ slug, status: "failed", lessonCount: 0, error: "Validation failed" });
      continue;
    }

    // Check existing
    if (opts.skipExisting && !opts.dryRun) {
      const exists = await courseExists(db, userId, data.course.topic);
      if (exists) {
        console.log(`  SKIPPED  ${slug} (already imported)`);
        results.push({ slug, status: "skipped", lessonCount: data.lessons.length });
        continue;
      }
    }

    try {
      const { lessonCount } = await importCourse(db, userId, data, slug, opts.dryRun);
      const prefix = opts.dryRun ? "DRY-RUN" : "OK";
      console.log(`  ${prefix.padEnd(7)}  ${slug} (${lessonCount} lessons)`);
      results.push({ slug, status: "ok", lessonCount });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  FAILED   ${slug}: ${msg}`);
      results.push({ slug, status: "failed", lessonCount: 0, error: msg });
    }
  }

  // Summary
  const ok = results.filter((r) => r.status === "ok");
  const skipped = results.filter((r) => r.status === "skipped");
  const failed = results.filter((r) => r.status === "failed");

  console.log("");
  console.log("═".repeat(50));
  console.log(`IMPORT SUMMARY (${opts.db}${opts.dryRun ? ", dry-run" : ""})`);
  console.log("═".repeat(50));
  for (const r of results) {
    const tag =
      r.status === "ok"
        ? (opts.dryRun ? "DRY-RUN" : "OK")
        : r.status === "skipped"
          ? "SKIPPED"
          : "FAILED";
    const detail =
      r.status === "failed"
        ? ` — ${r.error}`
        : r.status === "skipped"
          ? " (already imported)"
          : ` (${r.lessonCount} lessons)`;
    console.log(`  ${tag.padEnd(7)}  ${r.slug}${detail}`);
  }
  console.log("");
  console.log(
    `Courses: ${ok.length} ${opts.dryRun ? "previewed" : "imported"}, ${skipped.length} skipped, ${failed.length} failed`
  );

  if (db.close) db.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
