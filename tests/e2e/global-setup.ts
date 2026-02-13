import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const DB_NAME = "e2e-test.db";

/**
 * Playwright global setup — runs BEFORE the webServer starts.
 * Creates a fresh SQLite database for E2E tests so they never
 * touch the development database (dev.db).
 */
export default async function globalSetup() {
  const dbPath = path.resolve(process.cwd(), DB_NAME);

  // Remove old DB files so every test run starts clean
  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    try {
      fs.unlinkSync(dbPath + suffix);
    } catch {
      // file doesn't exist — that's fine
    }
  }

  // Create a fresh DB with the current Prisma schema
  execSync("npx prisma db push --accept-data-loss", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: "pipe",
  });
}
