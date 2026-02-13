import { test, expect } from "@playwright/test";
import { seedMockMode } from "./helpers/seed";

test.describe("Scratchpad", () => {
  test.beforeEach(async ({ page }) => {
    await seedMockMode(page);
  });

  async function createReadyLesson(page: import("@playwright/test").Page) {
    const courseRes = await page.request.post("/api/courses", {
      data: {
        title: "Test Course",
        description: "A test course",
        topic: "Mathematics",
      },
    });
    const course = await courseRes.json();

    await page.request.post("/api/generate/course", {
      headers: { "x-api-key": "test-key" },
      data: { courseId: course.id, topic: "Math", model: "mock" },
    });

    const detailRes = await page.request.get(`/api/courses/${course.id}`);
    const detail = await detailRes.json();
    const lessonId = detail.lessons[0].id;

    await page.request.post("/api/generate/lesson", {
      headers: { "x-api-key": "test-key" },
      data: { lessonId, courseId: course.id, model: "mock" },
    });

    return { courseId: course.id, lessonId };
  }

  test("open scratchpad and type text", async ({ page }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);

    // Wait for lesson content
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Open scratchpad
    await page.getByRole("button", { name: /Scratchpad/i }).click();

    // Find the editor textarea and type
    const editor = page.locator("textarea").first();
    await editor.waitFor({ timeout: 5000 });
    await editor.fill("Hello LaTeX world!");

    // Content should be in the textarea
    await expect(editor).toHaveValue("Hello LaTeX world!");
  });

  test("scratchpad content persists across page reloads", async ({ page }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Open scratchpad and type
    await page.getByRole("button", { name: /Scratchpad/i }).click();
    const editor = page.locator("textarea").first();
    await editor.waitFor({ timeout: 5000 });
    await editor.fill("Persistent note content");

    // Save immediately with Ctrl+S (autosave is 30s, too slow for tests)
    await editor.press("Control+s");
    // Wait for the save request to complete
    await page.waitForTimeout(1000);

    // Reload page
    await page.reload();
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Reopen scratchpad
    await page.getByRole("button", { name: /Scratchpad/i }).click();
    const editor2 = page.locator("textarea").first();
    await editor2.waitFor({ timeout: 5000 });

    // Content should be preserved
    await expect(editor2).toHaveValue("Persistent note content");
  });
});
