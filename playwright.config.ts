import { defineConfig, devices } from "@playwright/test";
import path from "path";

const E2E_PORT = 3001;
const E2E_DB = path.resolve("e2e-test.db");

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  timeout: 60000,
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next dev --port ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: {
      DATABASE_URL: `file:${E2E_DB}`,
      NEXT_TEST_MODE: "1",
      AUTH_DEV_BYPASS: "true",
      AUTH_SECRET: "e2e-test-secret-at-least-32-chars-long",
    },
  },
});
