#!/usr/bin/env node

/**
 * Production Migration Tracker for Turso
 *
 * Prisma v7 cannot connect to libsql:// URLs, so schema changes must be
 * applied via the Turso HTTP pipeline API. This script tracks, plans,
 * applies, and records migrations reliably.
 *
 * Usage:
 *   node scripts/migrate-prod.mjs <command> [args]
 *
 * Commands:
 *   status              Show local vs prod migration state
 *   plan                Dry run — show SQL that would be applied
 *   apply               Apply pending migrations (with confirmation)
 *   drift               Detect schema drift (no migration file)
 *   drift --fix         Generate migration file from drift and backfill
 *   backfill            Mark all existing migrations as already-applied
 *   backfill <name>     Mark one specific migration as already-applied
 *   tables              List all production tables
 *   inspect <table>     Show columns for a production table
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { createInterface } from "node:readline";
import { execFileSync } from "node:child_process";

// ─── Constants ───────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, "..");
const ENV_FILE = join(ROOT, ".env.secret");
const MIGRATIONS_DIR = join(ROOT, "prisma", "migrations");

const TRACKER_DDL = `CREATE TABLE IF NOT EXISTS "_migration_tracker" (
  "name"        TEXT NOT NULL PRIMARY KEY,
  "checksum"    TEXT,
  "sql_preview" TEXT,
  "started_at"  TEXT NOT NULL,
  "finished_at" TEXT,
  "status"      TEXT NOT NULL DEFAULT 'pending'
)`;

// ─── Environment ─────────────────────────────────────────────────────────────

function readEnvFile() {
  if (!existsSync(ENV_FILE)) {
    console.error(`ERROR: ${ENV_FILE} not found.`);
    console.error("This file must contain TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
    process.exit(1);
  }
  const env = {};
  const lines = readFileSync(ENV_FILE, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  }
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
    console.error("ERROR: .env.secret must define TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
    process.exit(1);
  }
  return env;
}

// ─── Turso HTTP API ──────────────────────────────────────────────────────────

function tursoBaseUrl(env) {
  return env.TURSO_DATABASE_URL.replace("libsql://", "https://");
}

async function tursoExec(env, statements) {
  const requests = statements.map((sql) => ({
    type: "execute",
    stmt: { sql },
  }));
  const res = await fetch(`${tursoBaseUrl(env)}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.TURSO_AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Turso API ${res.status}: ${text}`);
  }
  return (await res.json()).results;
}

async function tursoQuery(env, sql) {
  const results = await tursoExec(env, [sql]);
  const r = results[0];
  if (r.type === "error") {
    throw new Error(`SQL error: ${r.error?.message || JSON.stringify(r.error)}`);
  }
  return r.response.result;
}

// ─── SQL Utilities ───────────────────────────────────────────────────────────

/**
 * Split SQL text into individual statements on `;` boundaries,
 * respecting single-quoted strings.
 */
function splitStatements(sql) {
  const stmts = [];
  let current = "";
  let inString = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && !inString) {
      inString = true;
      current += ch;
    } else if (ch === "'" && inString) {
      // Handle escaped quotes ''
      if (i + 1 < sql.length && sql[i + 1] === "'") {
        current += "''";
        i++;
      } else {
        inString = false;
        current += ch;
      }
    } else if (ch === ";" && !inString) {
      const trimmed = current.trim();
      if (trimmed) stmts.push(trimmed);
      current = "";
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) stmts.push(trimmed);

  return stmts;
}

function computeChecksum(content) {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

/**
 * Apply idempotency wrappers to SQL statements:
 * - CREATE TABLE → CREATE TABLE IF NOT EXISTS
 * - CREATE INDEX → CREATE INDEX IF NOT EXISTS
 * - CREATE UNIQUE INDEX → CREATE UNIQUE INDEX IF NOT EXISTS
 */
function makeIdempotent(sql) {
  let s = sql;
  s = s.replace(
    /\bCREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS\b)/gi,
    "CREATE TABLE IF NOT EXISTS "
  );
  s = s.replace(
    /\bCREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS\b)/gi,
    "CREATE UNIQUE INDEX IF NOT EXISTS "
  );
  s = s.replace(
    /\bCREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS\b)(?!UNIQUE\b)/gi,
    "CREATE INDEX IF NOT EXISTS "
  );
  return s;
}

/**
 * Detect table-recreate patterns (DROP TABLE + RENAME TO)
 * that are non-idempotent.
 */
function detectTableRecreate(statements) {
  const warnings = [];
  for (let i = 0; i < statements.length; i++) {
    const s = statements[i].toUpperCase();
    if (s.includes("DROP TABLE") || s.includes("RENAME TO")) {
      warnings.push(
        `  Statement ${i + 1}: ${statements[i].slice(0, 80)}...`
      );
    }
  }
  return warnings;
}

// ─── Tracker Table ───────────────────────────────────────────────────────────

async function ensureTrackerTable(env) {
  await tursoExec(env, [TRACKER_DDL]);
}

async function getAppliedMigrations(env) {
  const result = await tursoQuery(
    env,
    'SELECT "name", "checksum", "status", "started_at", "finished_at" FROM "_migration_tracker" ORDER BY "name"'
  );
  return result.rows.map((r) => ({
    name: r[0].value,
    checksum: r[1]?.value ?? null,
    status: r[2].value,
    startedAt: r[3].value,
    finishedAt: r[4]?.value ?? null,
  }));
}

// ─── Local Migrations ────────────────────────────────────────────────────────

function getLocalMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return [];

  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "migration_lock.toml")
    .map((d) => d.name)
    .sort();

  return dirs.map((name) => {
    const sqlPath = join(MIGRATIONS_DIR, name, "migration.sql");
    const sql = existsSync(sqlPath) ? readFileSync(sqlPath, "utf-8") : null;
    return {
      name,
      sqlPath,
      sql,
      checksum: sql ? computeChecksum(sql) : null,
    };
  });
}

// ─── Interactive Prompt ──────────────────────────────────────────────────────

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function confirm(message) {
  const answer = await ask(`${message} [y/N] `);
  return answer === "y" || answer === "yes";
}

// ─── Formatted Output ────────────────────────────────────────────────────────

function pad(str, len) {
  return String(str).padEnd(len);
}

const STATUS_COLORS = {
  applied: "\x1b[32m",    // green
  backfilled: "\x1b[36m", // cyan
  pending: "\x1b[33m",    // yellow
  failed: "\x1b[31m",     // red
  missing: "\x1b[31m",    // red
};
const RESET = "\x1b[0m";

function colorStatus(status) {
  const color = STATUS_COLORS[status] || "";
  return `${color}${status}${RESET}`;
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdStatus(env) {
  await ensureTrackerTable(env);
  const local = getLocalMigrations();
  const applied = await getAppliedMigrations(env);
  const appliedMap = new Map(applied.map((a) => [a.name, a]));

  console.log("\n  Production Migration Status\n");
  console.log(
    `  ${pad("Migration", 50)} ${pad("Local", 7)} ${pad("Prod", 12)} ${pad("Checksum", 10)}`
  );
  console.log("  " + "─".repeat(82));

  // Show local migrations
  for (const m of local) {
    const a = appliedMap.get(m.name);
    const prodStatus = a ? a.status : "pending";
    const checksumMatch = a?.checksum
      ? a.checksum === m.checksum
        ? "OK"
        : "MISMATCH"
      : "—";
    console.log(
      `  ${pad(m.name, 50)} ${pad("yes", 7)} ${colorStatus(prodStatus).padEnd(12 + 9)} ${checksumMatch}`
    );
  }

  // Show applied-only (ad-hoc) migrations not in local
  for (const a of applied) {
    if (!local.find((m) => m.name === a.name)) {
      console.log(
        `  ${pad(a.name, 50)} ${pad("no", 7)} ${colorStatus(a.status).padEnd(12 + 9)} ${"—"}`
      );
    }
  }

  // Summary
  const pendingCount = local.filter((m) => !appliedMap.has(m.name)).length;
  const failedCount = applied.filter((a) => a.status === "failed").length;
  console.log();
  if (failedCount > 0) {
    console.log(`  \x1b[31m${failedCount} failed migration(s)\x1b[0m`);
  }
  if (pendingCount > 0) {
    console.log(`  \x1b[33m${pendingCount} pending migration(s)\x1b[0m`);
  }
  if (pendingCount === 0 && failedCount === 0) {
    console.log("  \x1b[32mAll migrations applied.\x1b[0m");
  }
  console.log();
}

async function cmdPlan(env) {
  await ensureTrackerTable(env);
  const local = getLocalMigrations();
  const applied = await getAppliedMigrations(env);
  const appliedMap = new Map(applied.map((a) => [a.name, a]));

  const pending = local.filter((m) => {
    const a = appliedMap.get(m.name);
    return !a || a.status === "failed";
  });

  if (pending.length === 0) {
    console.log("\n  No pending migrations.\n");
    return;
  }

  console.log(`\n  ${pending.length} migration(s) to apply:\n`);
  for (const m of pending) {
    const a = appliedMap.get(m.name);
    const label = a?.status === "failed" ? " (retry — previously failed)" : "";
    console.log(`  ── ${m.name}${label} ──`);
    if (!m.sql) {
      console.log("    (no migration.sql found)");
      continue;
    }
    const stmts = splitStatements(m.sql);
    stmts.forEach((s, i) => {
      const preview = s.length > 120 ? s.slice(0, 120) + "..." : s;
      console.log(`    ${i + 1}. ${preview}`);
    });
    console.log();
  }
}

async function cmdApply(env) {
  await ensureTrackerTable(env);
  const local = getLocalMigrations();
  const applied = await getAppliedMigrations(env);
  const appliedMap = new Map(applied.map((a) => [a.name, a]));

  const pending = local.filter((m) => {
    const a = appliedMap.get(m.name);
    return !a || a.status === "failed";
  });

  if (pending.length === 0) {
    console.log("\n  No pending migrations.\n");
    return;
  }

  for (const m of pending) {
    const a = appliedMap.get(m.name);
    console.log(`\n  ── ${m.name} ──`);

    if (a?.status === "failed") {
      const answer = await ask("  Previously failed. (r)etry / (s)kip / (a)bort? ");
      if (answer === "s" || answer === "skip") continue;
      if (answer === "a" || answer === "abort") {
        console.log("  Aborted.");
        return;
      }
    }

    if (!m.sql) {
      console.log("  WARNING: No migration.sql found — skipping.");
      continue;
    }

    const rawStmts = splitStatements(m.sql);
    const stmts = rawStmts.map(makeIdempotent);

    // Detect table-recreate patterns
    const recreateWarnings = detectTableRecreate(rawStmts);
    if (recreateWarnings.length > 0) {
      console.log("\n  \x1b[33mWARNING: Non-idempotent table-recreate pattern detected:\x1b[0m");
      recreateWarnings.forEach((w) => console.log(w));
      console.log("  Re-running this migration may fail if already partially applied.");
      console.log();
    }

    // Show all statements
    console.log(`  Statements to execute (${stmts.length}):\n`);
    stmts.forEach((s, i) => {
      const preview = s.length > 200 ? s.slice(0, 200) + "..." : s;
      console.log(`    ${i + 1}. ${preview}`);
    });
    console.log();

    const ok = await confirm(`  Apply these ${stmts.length} statements to production?`);
    if (!ok) {
      console.log("  Skipped.");
      continue;
    }

    // Execute all statements in one pipeline
    const now = new Date().toISOString();
    console.log("  Executing...");

    try {
      const results = await tursoExec(env, stmts);
      let allOk = true;
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.type === "ok") {
          console.log(`    \x1b[32mOK\x1b[0m  ${i + 1}. ${stmts[i].slice(0, 80)}`);
        } else {
          const errMsg = r.error?.message || JSON.stringify(r.error);
          // Handle duplicate column errors gracefully
          if (errMsg.includes("duplicate column name")) {
            console.log(`    \x1b[36mSKIP\x1b[0m ${i + 1}. (column already exists) ${stmts[i].slice(0, 60)}`);
          } else {
            console.log(`    \x1b[31mFAIL\x1b[0m ${i + 1}. ${stmts[i].slice(0, 60)}`);
            console.log(`          ${errMsg}`);
            allOk = false;
          }
        }
      }

      // Record result in tracker
      const finishedAt = new Date().toISOString();
      const status = allOk ? "applied" : "failed";
      const preview = m.sql.slice(0, 500);

      if (a?.status === "failed") {
        await tursoExec(env, [
          `UPDATE "_migration_tracker" SET "status" = '${status}', "checksum" = '${m.checksum}', "sql_preview" = '${preview.replace(/'/g, "''")}', "started_at" = '${now}', "finished_at" = '${finishedAt}' WHERE "name" = '${m.name}'`,
        ]);
      } else {
        await tursoExec(env, [
          `INSERT INTO "_migration_tracker" ("name", "checksum", "sql_preview", "started_at", "finished_at", "status") VALUES ('${m.name}', '${m.checksum}', '${preview.replace(/'/g, "''")}', '${now}', '${finishedAt}', '${status}')`,
        ]);
      }

      if (allOk) {
        console.log(`  \x1b[32mMigration applied successfully.\x1b[0m`);
      } else {
        console.log(`  \x1b[31mMigration had failures — marked as 'failed'.\x1b[0m`);
      }
    } catch (err) {
      console.error(`  \x1b[31mPipeline error: ${err.message}\x1b[0m`);
      const errPreview = m.sql.slice(0, 500);
      try {
        if (a?.status === "failed") {
          await tursoExec(env, [
            `UPDATE "_migration_tracker" SET "status" = 'failed', "started_at" = '${now}', "finished_at" = '${new Date().toISOString()}' WHERE "name" = '${m.name}'`,
          ]);
        } else {
          await tursoExec(env, [
            `INSERT INTO "_migration_tracker" ("name", "checksum", "sql_preview", "started_at", "finished_at", "status") VALUES ('${m.name}', '${m.checksum}', '${errPreview.replace(/'/g, "''")}', '${now}', '${new Date().toISOString()}', 'failed')`,
          ]);
        }
      } catch {
        // Best effort — tracker write also failed
      }
    }
  }
}

async function cmdDrift(env, fix) {
  console.log("\n  Checking schema drift...\n");

  // Use execFileSync with npx to avoid shell injection — all args are hardcoded
  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  let driftSql;
  try {
    driftSql = execFileSync(
      npxCmd,
      [
        "prisma", "migrate", "diff",
        "--from-migrations", "prisma/migrations",
        "--to-schema", "prisma/schema.prisma",
        "--script",
      ],
      { cwd: ROOT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
  } catch (err) {
    // prisma migrate diff exits non-zero when drift exists
    driftSql = err.stdout || "";
  }

  const trimmed = driftSql.trim();
  if (!trimmed || trimmed === "-- This is an empty migration.") {
    console.log("  No schema drift detected. Local migrations match schema.prisma.\n");
    return;
  }

  console.log("  Drift SQL:\n");
  console.log(trimmed.split("\n").map((l) => `    ${l}`).join("\n"));
  console.log();

  if (!fix) {
    console.log("  Run with --fix to generate a migration file and backfill.\n");
    return;
  }

  // Generate migration file
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14);

  const migrationName = await ask("  Migration name (e.g., gallery_tos_notifications): ");
  if (!migrationName) {
    console.log("  Aborted — no name provided.");
    return;
  }

  const dirName = `${timestamp}_${migrationName}`;
  const migrationDir = join(MIGRATIONS_DIR, dirName);
  const migrationFile = join(migrationDir, "migration.sql");

  mkdirSync(migrationDir, { recursive: true });
  writeFileSync(migrationFile, trimmed + "\n", "utf-8");

  console.log(`\n  Created: prisma/migrations/${dirName}/migration.sql`);

  // Since drift is already applied to prod, backfill it
  const ok = await confirm("  This drift is already applied to prod. Mark as backfilled?");
  if (!ok) {
    console.log("  Migration file created but NOT marked in tracker.");
    return;
  }

  await ensureTrackerTable(env);
  const checksum = computeChecksum(trimmed + "\n");
  const now = new Date().toISOString();
  const preview = trimmed.slice(0, 500);

  await tursoExec(env, [
    `INSERT OR REPLACE INTO "_migration_tracker" ("name", "checksum", "sql_preview", "started_at", "finished_at", "status") VALUES ('${dirName}', '${checksum}', '${preview.replace(/'/g, "''")}', '${now}', '${now}', 'backfilled')`,
  ]);

  console.log(`  \x1b[36mMarked ${dirName} as backfilled.\x1b[0m\n`);
}

async function cmdBackfill(env, specificName) {
  await ensureTrackerTable(env);
  const applied = await getAppliedMigrations(env);
  const appliedSet = new Set(applied.map((a) => a.name));

  if (specificName) {
    if (appliedSet.has(specificName)) {
      const existing = applied.find((a) => a.name === specificName);
      console.log(`\n  '${specificName}' is already tracked (status: ${existing.status}).\n`);
      return;
    }

    const local = getLocalMigrations();
    const localMigration = local.find((m) => m.name === specificName);

    const now = new Date().toISOString();
    const checksum = localMigration?.checksum ?? null;
    const preview = localMigration?.sql?.slice(0, 500) ?? null;

    console.log(`\n  Backfilling: ${specificName}`);
    if (localMigration) {
      console.log(`  (local migration found — checksum: ${checksum?.slice(0, 12)}...)`);
    } else {
      console.log("  (ad-hoc — no local migration file)");
    }

    const ok = await confirm("  Mark as backfilled in production tracker?");
    if (!ok) {
      console.log("  Cancelled.\n");
      return;
    }

    const checksumSql = checksum ? `'${checksum}'` : "NULL";
    const previewSql = preview ? `'${preview.replace(/'/g, "''")}'` : "NULL";
    await tursoExec(env, [
      `INSERT INTO "_migration_tracker" ("name", "checksum", "sql_preview", "started_at", "finished_at", "status") VALUES ('${specificName}', ${checksumSql}, ${previewSql}, '${now}', '${now}', 'backfilled')`,
    ]);
    console.log(`  \x1b[36mDone.\x1b[0m\n`);
    return;
  }

  // Backfill ALL local migrations not yet tracked
  const local = getLocalMigrations();
  const toBackfill = local.filter((m) => !appliedSet.has(m.name));

  if (toBackfill.length === 0) {
    console.log("\n  All local migrations are already tracked.\n");
    return;
  }

  console.log(`\n  ${toBackfill.length} migration(s) to backfill:\n`);
  for (const m of toBackfill) {
    console.log(`    ${m.name} (checksum: ${m.checksum?.slice(0, 12) ?? "—"}...)`);
  }
  console.log();

  const ok = await confirm("  Mark all as backfilled in production tracker?");
  if (!ok) {
    console.log("  Cancelled.\n");
    return;
  }

  const now = new Date().toISOString();
  const insertStmts = toBackfill.map((m) => {
    const checksumSql = m.checksum ? `'${m.checksum}'` : "NULL";
    const previewSql = m.sql ? `'${m.sql.slice(0, 500).replace(/'/g, "''")}'` : "NULL";
    return `INSERT INTO "_migration_tracker" ("name", "checksum", "sql_preview", "started_at", "finished_at", "status") VALUES ('${m.name}', ${checksumSql}, ${previewSql}, '${now}', '${now}', 'backfilled')`;
  });

  await tursoExec(env, insertStmts);
  console.log(`  \x1b[36m${toBackfill.length} migration(s) backfilled.\x1b[0m\n`);
}

async function cmdTables(env) {
  const result = await tursoQuery(
    env,
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  console.log("\n  Production tables:\n");
  for (const row of result.rows) {
    const name = row[0].value;
    if (name.startsWith("_")) {
      console.log(`    ${name} (internal)`);
    } else {
      console.log(`    ${name}`);
    }
  }
  console.log();
}

async function cmdInspect(env, tableName) {
  if (!tableName) {
    console.error("Usage: node scripts/migrate-prod.mjs inspect <table>");
    process.exit(1);
  }

  const result = await tursoQuery(env, `PRAGMA table_info("${tableName}")`);
  if (result.rows.length === 0) {
    console.log(`\n  Table "${tableName}" not found or has no columns.\n`);
    return;
  }

  console.log(`\n  Table: ${tableName}\n`);
  console.log(
    `  ${pad("Column", 35)} ${pad("Type", 15)} ${pad("Nullable", 10)} ${pad("Default", 30)} ${pad("PK", 4)}`
  );
  console.log("  " + "─".repeat(96));

  for (const row of result.rows) {
    const name = row[1].value;
    const type = row[2].value || "—";
    const notNull = row[3].value === "1" || row[3].value === 1;
    const dflt = row[4]?.value ?? "—";
    const pk = row[5].value === "1" || row[5].value === 1;

    console.log(
      `  ${pad(name, 35)} ${pad(type, 15)} ${pad(notNull ? "NOT NULL" : "nullable", 10)} ${pad(dflt, 30)} ${pad(pk ? "PK" : "", 4)}`
    );
  }

  // Also show indexes
  const idxResult = await tursoQuery(
    env,
    `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='${tableName}' ORDER BY name`
  );
  if (idxResult.rows.length > 0) {
    console.log(`\n  Indexes:\n`);
    for (const row of idxResult.rows) {
      const idxName = row[0].value;
      const idxSql = row[1]?.value ?? "(auto)";
      console.log(`    ${idxName}`);
      if (idxSql !== "(auto)" && idxSql) {
        console.log(`      ${idxSql}`);
      }
    }
  }
  console.log();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(`
  Production Migration Tracker

  Usage: node scripts/migrate-prod.mjs <command> [args]

  Commands:
    status              Show local vs prod migration state
    plan                Dry run — show SQL that would be applied
    apply               Apply pending migrations (with confirmation)
    drift               Detect schema drift (no migration file)
    drift --fix         Generate migration file from drift and backfill
    backfill            Mark all existing migrations as already-applied
    backfill <name>     Mark one specific migration as already-applied
    tables              List all production tables
    inspect <table>     Show columns for a production table
`);
    return;
  }

  const env = readEnvFile();

  switch (command) {
    case "status":
      await cmdStatus(env);
      break;
    case "plan":
      await cmdPlan(env);
      break;
    case "apply":
      await cmdApply(env);
      break;
    case "drift":
      await cmdDrift(env, args.includes("--fix"));
      break;
    case "backfill":
      await cmdBackfill(env, args[1]);
      break;
    case "tables":
      await cmdTables(env);
      break;
    case "inspect":
      await cmdInspect(env, args[1]);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run with --help for usage.");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\nFatal error: ${err.message}`);
  process.exit(1);
});
