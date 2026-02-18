---
name: migrate-prod
description: Apply pending Prisma schema changes to the production Turso database. Use when the user says "migrate prod", "push schema to production", "apply migrations to prod", or after creating new Prisma migrations.
allowed-tools: Bash, Read, Glob, Grep
argument-hint: [status|plan|apply|drift|backfill|tables|inspect <table>]
---

# Migrate Production Turso Database

## Background

Prisma CLI v7 **cannot** connect to `libsql://` URLs directly — the `migrate.adapter` config was removed in v7, and `prisma db push` / `prisma migrate deploy` only target the local SQLite `dev.db`. Schema changes to the production Turso database are tracked and applied via `scripts/migrate-prod.mjs`, which uses the **Turso HTTP pipeline API**.

## Quick Reference

```bash
# Check current state
node scripts/migrate-prod.mjs status

# Preview what would be applied
node scripts/migrate-prod.mjs plan

# Apply pending migrations (interactive confirmation)
node scripts/migrate-prod.mjs apply

# Detect schema drift (changes without migration files)
node scripts/migrate-prod.mjs drift

# Generate migration file from drift and backfill
node scripts/migrate-prod.mjs drift --fix

# Mark all existing migrations as already-applied
node scripts/migrate-prod.mjs backfill

# Mark one specific migration as already-applied
node scripts/migrate-prod.mjs backfill <name>

# List all production tables
node scripts/migrate-prod.mjs tables

# Inspect a specific table's columns and indexes
node scripts/migrate-prod.mjs inspect <table>
```

## Workflow

### Applying new migrations

1. Create migration locally: `npx prisma migrate dev --name <name>`
2. Preview: `node scripts/migrate-prod.mjs plan`
3. Apply: `node scripts/migrate-prod.mjs apply`
4. Verify: `node scripts/migrate-prod.mjs status`

### Handling schema drift

If changes were applied ad-hoc (without migration files):

1. Detect: `node scripts/migrate-prod.mjs drift`
2. Fix: `node scripts/migrate-prod.mjs drift --fix` (creates migration file + backfills tracker)
3. Verify: `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` should be empty

### First-time setup

If the tracker table doesn't exist yet:

1. `node scripts/migrate-prod.mjs backfill` — marks all existing migration files as already-applied
2. `node scripts/migrate-prod.mjs drift --fix` — captures any ad-hoc changes as a migration file

## Credentials

Production credentials live in `.env.turso-prod` (gitignored). The script reads this file automatically — no manual `export` needed.

## Important Notes

- **Always confirm with the user before executing** — the `apply` command modifies the production database
- The script requires explicit `y` confirmation before any write operation
- Each migration is applied atomically — all-or-nothing via Turso pipeline
- `CREATE TABLE` / `CREATE INDEX` are auto-wrapped with `IF NOT EXISTS`
- `ALTER TABLE ADD COLUMN` duplicate-column errors are caught and logged as SKIP
- Table-recreate patterns (`DROP TABLE` + `RENAME TO`) are flagged as non-idempotent
- Failed migrations are recorded and can be retried on next `apply`
