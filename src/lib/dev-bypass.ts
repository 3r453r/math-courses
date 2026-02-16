/**
 * Centralized guard for AUTH_DEV_BYPASS.
 *
 * Prevents dev bypass from accidentally running against production databases.
 * Zero dependencies — safe for Edge Runtime / middleware.
 */

let hasWarnedActive = false;

export function isDevBypassEnabled(): boolean {
  if (process.env.AUTH_DEV_BYPASS !== "true") {
    return false;
  }

  // Block in production unless running E2E tests (NEXT_TEST_MODE=1)
  if (process.env.NODE_ENV === "production" && process.env.NEXT_TEST_MODE !== "1") {
    console.error(
      "SECURITY: AUTH_DEV_BYPASS=true is set in production — ignoring. " +
        "Remove AUTH_DEV_BYPASS from production environment variables."
    );
    return false;
  }

  // Warn when bypass is active with a remote database
  if (process.env.TURSO_DATABASE_URL) {
    console.warn(
      "WARNING: AUTH_DEV_BYPASS is active with a remote database (TURSO_DATABASE_URL is set). " +
        "Dev bypass will write to the remote database. " +
        "Remove TURSO_DATABASE_URL from .env.local to use local SQLite instead."
    );
  }

  // Warn once that bypass is active
  if (!hasWarnedActive) {
    hasWarnedActive = true;
    console.warn("AUTH_DEV_BYPASS is active — authentication is bypassed.");
  }

  return true;
}
