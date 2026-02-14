import { Page } from "@playwright/test";

const STORE_KEY = "math-courses-app";
const STORE_DATA = JSON.stringify({
  state: {
    apiKey: "test-key",
    sidebarOpen: true,
    chatSidebarOpen: false,
    scratchpadOpen: false,
    notebookOpen: false,
    generationModel: "mock",
    chatModel: "mock",
  },
  version: 0,
});

/**
 * Seed localStorage with Zustand store data so the app uses mock mode.
 * Uses addInitScript to set localStorage BEFORE any page scripts execute
 * on every navigation. This prevents the Zustand hydration race condition
 * where useEffect sees apiKey=null and redirects to /setup before the
 * persist middleware hydrates from localStorage.
 */
export async function seedMockMode(page: Page) {
  await page.addInitScript(
    ([key, data]) => {
      try {
        localStorage.setItem(key, data);
      } catch {
        // localStorage may not be available on about:blank
      }
    },
    [STORE_KEY, STORE_DATA]
  );
}
