#!/usr/bin/env node
/**
 * import-gallery-local.mjs
 *
 * Imports all course-library JSON files into the local dev.db and creates
 * CourseShare gallery listings (isGalleryListed = true) for each course.
 *
 * Handles three edge formats produced by different batch assemblers:
 *   Format A (batch 1-6):  { fromIndex, toIndex, type }
 *   Format B (standard):   { fromLessonIndex, toLessonIndex, relationship }
 *   Format C (batch 7):    { fromLessonId, toLessonId, relationship }
 *
 * Usage:
 *   node scripts/import-gallery-local.mjs [--dry-run] [--file <slug>]
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';

const ROOT = resolve(import.meta.dirname, '..');
const JSON_DIR = join(ROOT, 'course-library', 'anthropic-json');
const DB_PATH = resolve(ROOT, 'dev.db');

// ─── CUID ─────────────────────────────────────────────────────────────────────

function cuid() {
  const ts = Date.now().toString(36);
  const rnd = randomUUID().replace(/-/g, '').slice(0, 16);
  return `c${ts}${rnd}`;
}

// ─── DB ───────────────────────────────────────────────────────────────────────

function openDb() {
  if (!existsSync(DB_PATH)) {
    console.error(`ERROR: dev.db not found at ${DB_PATH}`);
    console.error("Run 'pnpm dev' or 'npx prisma db push' to create it first.");
    process.exit(1);
  }
  return createClient({ url: `file:${DB_PATH}` });
}

async function dbQuery(client, sql, args = []) {
  const r = await client.execute({ sql, args });
  return r.rows;
}

async function dbExec(client, sql, args = []) {
  await client.execute({ sql, args });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializeSubject(subject) {
  if (!subject) return '["Other"]';
  if (subject.startsWith('[')) return subject;
  return JSON.stringify([subject]);
}

function serializeFocusAreas(focusAreas) {
  if (!focusAreas) return '[]';
  if (Array.isArray(focusAreas)) return JSON.stringify(focusAreas);
  if (typeof focusAreas === 'string') {
    if (focusAreas.startsWith('[')) return focusAreas;
    return JSON.stringify([focusAreas]);
  }
  return '[]';
}

function countQuestions(questionsJson) {
  try {
    const arr = JSON.parse(questionsJson);
    return Array.isArray(arr) ? arr.length : 5;
  } catch {
    return 5;
  }
}

// Normalize edge to { fromIdx, toIdx, relationship } or { fromLessonId, toLessonId, relationship }
function normalizeEdge(ed) {
  if (ed == null) return null;

  // Format A (batch 1-6): { fromIndex, toIndex, type }
  if ('fromIndex' in ed) {
    return { kind: 'index', fromIdx: ed.fromIndex, toIdx: ed.toIndex, relationship: ed.type ?? 'prerequisite' };
  }
  // Format B (standard export): { fromLessonIndex, toLessonIndex, relationship }
  if ('fromLessonIndex' in ed) {
    return { kind: 'index', fromIdx: ed.fromLessonIndex, toIdx: ed.toLessonIndex, relationship: ed.relationship ?? 'prerequisite' };
  }
  // Format C (batch 7): { fromLessonId, toLessonId, relationship }
  if ('fromLessonId' in ed) {
    return { kind: 'id', fromLessonId: ed.fromLessonId, toLessonId: ed.toLessonId, relationship: ed.relationship ?? 'prerequisite' };
  }
  return null;
}

// ─── Import one course ────────────────────────────────────────────────────────

async function importCourse(client, userId, data, slug, dryRun) {
  const now = new Date().toISOString();
  const { course: cd, lessons, edges = [] } = data;

  if (dryRun) {
    console.log(`  [dry-run] "${cd.title}" — ${lessons.length} lessons, ${edges.length} edges`);
    return true;
  }

  // Insert Course
  const courseId = cuid();
  await dbExec(client,
    `INSERT INTO "Course" (id, "userId", title, description, topic, subject, "focusAreas", "targetLessonCount", difficulty, language, "contextDoc", "passThreshold", "noLessonCanFail", "lessonFailureThreshold", status, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      courseId,
      userId,
      cd.title,
      cd.description ?? '',
      cd.topic,
      serializeSubject(cd.subject),
      serializeFocusAreas(cd.focusAreas),
      cd.targetLessonCount ?? lessons.length,
      cd.difficulty ?? 'intermediate',
      cd.language ?? 'en',
      cd.contextDoc ?? null,
      cd.passThreshold ?? 0.8,
      cd.noLessonCanFail ? 1 : 0,
      cd.lessonFailureThreshold ?? 0.5,
      cd.status ?? 'ready',
      now,
      now,
    ]
  );

  // Insert Lessons — build orderIndex→dbId and lessonKey→dbId maps
  const indexToId = new Map(); // orderIndex (number) → cuid
  const keyToId = new Map();   // "${slug}-lesson-N" style id → cuid

  for (const ld of lessons) {
    const lessonId = cuid();
    indexToId.set(ld.orderIndex, lessonId);
    if (ld.id) keyToId.set(ld.id, lessonId);

    await dbExec(client,
      `INSERT INTO "Lesson" (id, "courseId", "orderIndex", title, summary, status, "contentJson", "rawMarkdown", "isSupplementary", weight, "completedAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lessonId,
        courseId,
        ld.orderIndex,
        ld.title,
        ld.summary ?? '',
        ld.status ?? 'ready',
        ld.contentJson ?? null,
        ld.rawMarkdown ?? null,
        ld.isSupplementary ? 1 : 0,
        ld.weight ?? 1.0,
        ld.completedAt ?? null,
        now,
        now,
      ]
    );

    // Quizzes
    for (const qd of ld.quizzes ?? []) {
      const quizId = cuid();
      const qCount = qd.questionCount ?? countQuestions(qd.questionsJson ?? '[]');
      await dbExec(client,
        `INSERT INTO "Quiz" (id, "lessonId", "questionsJson", "questionCount", status, generation, "isActive", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quizId,
          lessonId,
          qd.questionsJson ?? '[]',
          qCount,
          qd.status ?? 'ready',
          qd.generation ?? 1,
          qd.isActive !== false ? 1 : 0,
          now,
        ]
      );
    }
  }

  // Insert Edges
  let edgesInserted = 0;
  let edgesSkipped = 0;
  for (const rawEdge of edges) {
    const ne = normalizeEdge(rawEdge);
    if (!ne) { edgesSkipped++; continue; }

    let fromId, toId;
    if (ne.kind === 'index') {
      fromId = indexToId.get(ne.fromIdx);
      toId = indexToId.get(ne.toIdx);
    } else {
      fromId = keyToId.get(ne.fromLessonId);
      toId = keyToId.get(ne.toLessonId);
    }

    if (!fromId || !toId) {
      edgesSkipped++;
      continue;
    }

    const edgeId = cuid();
    await dbExec(client,
      `INSERT OR IGNORE INTO "CourseEdge" (id, "courseId", "fromLessonId", "toLessonId", relationship) VALUES (?, ?, ?, ?, ?)`,
      [edgeId, courseId, fromId, toId, ne.relationship]
    );
    edgesInserted++;
  }

  // Create CourseShare gallery listing
  const shareId = cuid();
  const shareToken = randomUUID();
  await dbExec(client,
    `INSERT INTO "CourseShare" (id, "courseId", "shareToken", "isActive", "isGalleryListed", "createdAt") VALUES (?, ?, ?, ?, ?, ?)`,
    [shareId, courseId, shareToken, 1, 1, now]
  );

  console.log(`  OK       ${slug} (${lessons.length} lessons, ${edgesInserted} edges, gallery: ${shareToken.slice(0,8)}...)`);
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const fileArg = process.argv.indexOf('--file');
  const specificFile = fileArg !== -1 ? process.argv[fileArg + 1] : null;

  if (!existsSync(JSON_DIR)) {
    console.error(`ERROR: Directory not found: ${JSON_DIR}`);
    process.exit(1);
  }

  // Gather files — exclude *-tmp.json and *-partN-tmp.json
  let allFiles = readdirSync(JSON_DIR)
    .filter(f => f.endsWith('.json') && !f.includes('-tmp.json') && !f.includes('-part1') && !f.includes('-part2'))
    .sort();

  if (specificFile) {
    const target = specificFile.endsWith('.json') ? specificFile : `${specificFile}.json`;
    allFiles = allFiles.filter(f => f === target);
    if (allFiles.length === 0) {
      console.error(`ERROR: File not found: ${target}`);
      process.exit(1);
    }
  }

  console.log(`Found ${allFiles.length} course files.${dryRun ? ' (DRY RUN)' : ''}`);

  const client = openDb();

  // Find user (admin > any active > error)
  let userId;
  const adminRows = await dbQuery(client, `SELECT id FROM "User" WHERE role = 'admin' AND "accessStatus" = 'active' ORDER BY "createdAt" ASC LIMIT 1`);
  if (adminRows.length > 0) {
    userId = adminRows[0].id;
    console.log(`Using admin user: ${userId}`);
  } else {
    const activeRows = await dbQuery(client, `SELECT id FROM "User" WHERE "accessStatus" = 'active' ORDER BY "createdAt" ASC LIMIT 1`);
    if (activeRows.length > 0) {
      userId = activeRows[0].id;
      console.log(`Using active user: ${userId}`);
    } else {
      console.error('ERROR: No active user found in dev.db. Run the app and sign in first.');
      process.exit(1);
    }
  }

  let ok = 0, skipped = 0, failed = 0;

  for (const file of allFiles) {
    const slug = file.replace(/\.json$/, '');
    const filePath = join(JSON_DIR, file);

    // Parse
    let data;
    try {
      data = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.error(`  FAILED   ${slug}: JSON parse error — ${e.message}`);
      failed++;
      continue;
    }

    // Validate
    if (data.version !== 1 || !data.course || !Array.isArray(data.lessons) || data.lessons.length === 0) {
      console.error(`  FAILED   ${slug}: Invalid format (version=${data.version}, lessons=${data.lessons?.length ?? 0})`);
      failed++;
      continue;
    }

    // Check existing (by topic)
    if (!dryRun) {
      const existing = await dbQuery(client,
        `SELECT id FROM "Course" WHERE "userId" = ? AND topic = ? LIMIT 1`,
        [userId, data.course.topic]
      );
      if (existing.length > 0) {
        console.log(`  SKIPPED  ${slug} (already imported)`);
        skipped++;
        continue;
      }
    }

    try {
      await importCourse(client, userId, data, slug, dryRun);
      ok++;
    } catch (e) {
      console.error(`  FAILED   ${slug}: ${e.message}`);
      failed++;
    }
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log(`SUMMARY: ${ok} ${dryRun ? 'previewed' : 'imported'}, ${skipped} skipped, ${failed} failed`);
  if (!dryRun && ok > 0) {
    console.log(`✅ ${ok} courses imported with gallery listings (isGalleryListed=true)`);
  }

  client.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
