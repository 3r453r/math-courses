import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// We need to re-import the module fresh for each test to reset the `hasWarnedActive` flag
describe("isDevBypassEnabled", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.AUTH_DEV_BYPASS;
    delete process.env.NODE_ENV;
    delete process.env.NEXT_TEST_MODE;
    delete process.env.TURSO_DATABASE_URL;
    vi.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns false when AUTH_DEV_BYPASS is not set", async () => {
    const { isDevBypassEnabled } = await import("./dev-bypass");
    expect(isDevBypassEnabled()).toBe(false);
  });

  it("returns false when AUTH_DEV_BYPASS is 'false'", async () => {
    process.env.AUTH_DEV_BYPASS = "false";
    const { isDevBypassEnabled } = await import("./dev-bypass");
    expect(isDevBypassEnabled()).toBe(false);
  });

  it("returns true in development mode with bypass enabled", async () => {
    process.env.AUTH_DEV_BYPASS = "true";
    process.env.NODE_ENV = "development";
    const { isDevBypassEnabled } = await import("./dev-bypass");
    expect(isDevBypassEnabled()).toBe(true);
  });

  it("returns true in test mode with bypass enabled", async () => {
    process.env.AUTH_DEV_BYPASS = "true";
    process.env.NODE_ENV = "test";
    const { isDevBypassEnabled } = await import("./dev-bypass");
    expect(isDevBypassEnabled()).toBe(true);
  });

  it("returns true in production with NEXT_TEST_MODE=1 (E2E tests)", async () => {
    process.env.AUTH_DEV_BYPASS = "true";
    process.env.NODE_ENV = "production";
    process.env.NEXT_TEST_MODE = "1";
    const { isDevBypassEnabled } = await import("./dev-bypass");
    expect(isDevBypassEnabled()).toBe(true);
  });

  it("returns false in production without NEXT_TEST_MODE (the critical fix)", async () => {
    process.env.AUTH_DEV_BYPASS = "true";
    process.env.NODE_ENV = "production";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { isDevBypassEnabled } = await import("./dev-bypass");
    expect(isDevBypassEnabled()).toBe(false);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("SECURITY"));
    spy.mockRestore();
  });

  it("logs a warning when TURSO_DATABASE_URL is set", async () => {
    process.env.AUTH_DEV_BYPASS = "true";
    process.env.NODE_ENV = "development";
    process.env.TURSO_DATABASE_URL = "libsql://example.turso.io";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { isDevBypassEnabled } = await import("./dev-bypass");
    isDevBypassEnabled();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("remote database"));
    spy.mockRestore();
  });

  it("logs the active warning only once per process", async () => {
    process.env.AUTH_DEV_BYPASS = "true";
    process.env.NODE_ENV = "development";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { isDevBypassEnabled } = await import("./dev-bypass");
    isDevBypassEnabled();
    isDevBypassEnabled();
    isDevBypassEnabled();
    const activeWarnings = spy.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("authentication is bypassed")
    );
    expect(activeWarnings).toHaveLength(1);
    spy.mockRestore();
  });
});
