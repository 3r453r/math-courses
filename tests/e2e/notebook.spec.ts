import { test, expect } from "@playwright/test";
import { seedMockMode } from "./helpers/seed";

test.describe("Notebook", () => {
  test.beforeEach(async ({ page }) => {
    await seedMockMode(page);
  });

  async function createCourseWithScratchpadNotes(
    page: import("@playwright/test").Page
  ) {
    // Create course
    const courseRes = await page.request.post("/api/courses", {
      data: {
        title: "Notebook Test Course",
        description: "A test course",
        topic: "Mathematics",
      },
    });
    const course = await courseRes.json();

    // Generate course structure (creates 1 mock lesson)
    await page.request.post("/api/generate/course", {
      headers: { "x-api-key": "test-key" },
      data: { courseId: course.id, topic: "Math", model: "mock" },
    });

    // Get the generated lesson
    const detailRes = await page.request.get(`/api/courses/${course.id}`);
    const detail = await detailRes.json();
    const lesson1 = detail.lessons[0];

    // Generate content for lesson 1 so we can create a second lesson too
    await page.request.post("/api/generate/lesson", {
      headers: { "x-api-key": "test-key" },
      data: { lessonId: lesson1.id, courseId: course.id, model: "mock" },
    });

    // Create a second lesson via the course API (mock only creates 1)
    // We'll use the database directly through the courses API by generating another lesson
    // Actually, let's just use the scratchpad API to create notes for the one lesson
    // and create a custom notebook page for the second "page"

    // Create scratchpad note with content for lesson 1
    const sp1Res = await page.request.get(
      `/api/notes/scratchpad?lessonId=${lesson1.id}`
    );
    const sp1 = await sp1Res.json();
    await page.request.put("/api/notes/scratchpad", {
      data: { id: sp1.id, content: "Notes for lesson 1" },
    });

    // Create a custom notebook page as the second page
    await page.request.post(`/api/courses/${course.id}/notebook`, {
      data: { title: "Custom Notes", orderIndex: 1 },
    });
    // Update custom page with content
    const nbRes = await page.request.get(`/api/courses/${course.id}/notebook`);
    const nb = await nbRes.json();
    const customPage = nb.pages.find(
      (p: { type: string }) => p.type === "custom"
    );
    if (customPage) {
      await page.request.put(
        `/api/courses/${course.id}/notebook/${customPage.id}`,
        { data: { content: "Notes for custom page" } }
      );
    }

    return { courseId: course.id, lesson1 };
  }

  test("open notebook panel on course overview", async ({ page }) => {
    const { courseId } = await createCourseWithScratchpadNotes(page);
    await page.goto(`/courses/${courseId}`);
    await expect(page.getByText("Mock Test Course")).toBeVisible({
      timeout: 15000,
    });

    // Click Notebook button
    await page.getByRole("button", { name: /Notebook/i }).click();

    // Notebook panel should appear
    const aside = page.locator("[data-testid='notebook-aside']");
    await aside.waitFor({ timeout: 5000 });
    await expect(aside).toBeVisible();

    // Should show lesson pages
    await expect(page.getByText("Notes for lesson 1")).toBeVisible({
      timeout: 5000,
    });
  });

  test("navigate between pages with prev/next", async ({ page }) => {
    const { courseId } = await createCourseWithScratchpadNotes(page);
    await page.goto(`/courses/${courseId}`);
    await expect(page.getByText("Mock Test Course")).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("button", { name: /Notebook/i }).click();
    const aside = page.locator("[data-testid='notebook-aside']");
    await aside.waitFor({ timeout: 5000 });

    // Should show first page content
    await expect(page.locator("textarea").first()).toHaveValue(
      "Notes for lesson 1",
      { timeout: 5000 }
    );

    // Navigate to next (custom page)
    await page.getByRole("button", { name: "Next →" }).click();
    await expect(page.locator("textarea").first()).toHaveValue(
      "Notes for custom page",
      { timeout: 5000 }
    );

    // Navigate back
    await page.getByRole("button", { name: "← Previous" }).click();
    await expect(page.locator("textarea").first()).toHaveValue(
      "Notes for lesson 1",
      { timeout: 5000 }
    );
  });

  test("insert custom page between lesson pages", async ({ page }) => {
    const { courseId } = await createCourseWithScratchpadNotes(page);
    await page.goto(`/courses/${courseId}`);
    await expect(page.getByText("Mock Test Course")).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("button", { name: /Notebook/i }).click();
    const aside = page.locator("[data-testid='notebook-aside']");
    await aside.waitFor({ timeout: 5000 });

    // Wait for pages to load
    await expect(page.getByText("Notes for lesson 1")).toBeVisible({
      timeout: 5000,
    });

    // Find and click an insert button (the "+" between pages)
    // nth(0) is the "insert at top" button; nth(1) is after the first page
    const insertButtons = aside.locator('button[title="Insert custom page"]');
    await insertButtons.nth(1).click({ force: true });

    // Should see "Untitled" in the page list
    await expect(aside.getByText("Untitled")).toBeVisible({ timeout: 10000 });
  });

  test("lesson page title links to lesson", async ({ page }) => {
    const { courseId, lesson1 } = await createCourseWithScratchpadNotes(page);
    await page.goto(`/courses/${courseId}`);
    await expect(page.getByText("Mock Test Course")).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("button", { name: /Notebook/i }).click();
    const aside = page.locator("[data-testid='notebook-aside']");
    await aside.waitFor({ timeout: 5000 });

    // Wait for pages to load
    await expect(aside.getByText("Go to lesson").first()).toBeVisible({
      timeout: 5000,
    });

    // The "Go to lesson" link should point to the lesson page
    const lessonLink = aside.getByText("Go to lesson").first();
    const href = await lessonLink.getAttribute("href");
    expect(href).toContain(`/courses/${courseId}/lessons/${lesson1.id}`);
  });
});
