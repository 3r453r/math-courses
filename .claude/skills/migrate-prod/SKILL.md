---
name: migrate-prod
description: Apply pending Prisma schema changes to the production Turso database. Use when the user says "migrate prod", "push schema to production", "apply migrations to prod", or after creating new Prisma migrations.
allowed-tools: Bash, Read, Glob, Grep
argument-hint: [migration-name or "all"]
---

# Migrate Production Turso Database

## Background

Prisma CLI v7 **cannot** connect to `libsql://` URLs directly — the `migrate.adapter` config was removed in v7, and `prisma db push` / `prisma migrate deploy` only target the local SQLite `dev.db`. Schema changes to the production Turso database must be applied via the **Turso HTTP pipeline API**.

## Credentials

Production credentials live in `.env.turso-prod` (gitignored). On Windows bash, `source .env.turso-prod` does NOT propagate to child processes. Always use explicit `export` statements:

```bash
export TURSO_DATABASE_URL="<from .env.turso-prod>"
export TURSO_AUTH_TOKEN="<from .env.turso-prod>"
```

Read the values from `.env.turso-prod` at the start of each invocation.

## Procedure

### 1. Identify what needs to be applied

Compare the current Prisma schema (`prisma/schema.prisma`) against what exists in production. Query the production table schema using the Turso HTTP API:

```bash
export TURSO_DATABASE_URL="..." && export TURSO_AUTH_TOKEN="..."

# List all tables
node -e "
async function main() {
  const res = await fetch(process.env.TURSO_DATABASE_URL.replace('libsql://', 'https://') + '/v2/pipeline', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.TURSO_AUTH_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql: 'SELECT name FROM sqlite_master WHERE type=\"table\" ORDER BY name' } }] })
  });
  const data = await res.json();
  data.results[0].response.result.rows.forEach(r => console.log(r[0].value));
}
main();
"

# Check columns on a specific table
node -e "
async function main() {
  const table = '$ARGUMENTS'; // or hardcode the table name
  const res = await fetch(process.env.TURSO_DATABASE_URL.replace('libsql://', 'https://') + '/v2/pipeline', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.TURSO_AUTH_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql: 'PRAGMA table_info(' + table + ')' } }] })
  });
  const data = await res.json();
  data.results[0].response.result.rows.forEach(r => console.log(r[1].value, r[2].value, r[3].value === '1' ? 'NOT NULL' : 'nullable'));
}
main();
"
```

### 2. Read migration SQL files

Check `prisma/migrations/*/migration.sql` for the SQL that needs to be applied. If specific migrations are requested, read only those. Otherwise, diff all migrations against the production state.

### 3. Apply SQL via Turso HTTP API

Use the pipeline endpoint to execute multiple statements atomically:

```bash
node -e "
async function main() {
  const statements = [
    // Add each ALTER TABLE / CREATE INDEX / CREATE TABLE statement here
    'ALTER TABLE \"TableName\" ADD COLUMN \"columnName\" TEXT',
  ];
  const requests = statements.map(sql => ({ type: 'execute', stmt: { sql } }));
  const res = await fetch(process.env.TURSO_DATABASE_URL.replace('libsql://', 'https://') + '/v2/pipeline', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.TURSO_AUTH_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests })
  });
  const data = await res.json();
  data.results.forEach((r, i) => {
    if (r.type === 'ok') console.log('OK:', statements[i]);
    else console.error('FAIL:', statements[i], r.error);
  });
}
main();
"
```

### 4. Verify

After applying, re-query `PRAGMA table_info(TableName)` and/or `SELECT name FROM sqlite_master WHERE type='index'` to confirm the changes landed.

## Important notes

- **Always confirm with the user before executing** — this modifies the production database
- The Turso HTTP URL is the `libsql://` URL with the scheme replaced by `https://`
- SQLite `ALTER TABLE` only supports `ADD COLUMN` — to rename/drop columns, you need to recreate the table
- `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` are safe to re-run
- If a migration includes `CREATE TABLE` for a table that already exists (from previous `db push`), skip it or use `IF NOT EXISTS`
