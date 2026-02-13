import { test, expect } from "@playwright/test";
import { seedMockMode } from "./helpers/seed";

test.describe("Diagnostic Flow", () => {
  test.beforeEach(async ({ page }) => {
    await seedMockMode(page);
  });

  async function createReadyCourse(page: import("@playwright/test").Page) {
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

    return course;
  }

  test("generate diagnostic quiz and see questions", async ({ page }) => {
    const course = await createReadyCourse(page);
    await page.goto(`/courses/${course.id}/diagnostic`);

    const generateBtn = page.getByRole("button", {
      name: /Generate Diagnostic Quiz/i,
    });
    await generateBtn.waitFor({ timeout: 15000 });
    await generateBtn.click();

    // Wait for questions to appear
    await expect(page.getByText("Diagnostic 1:")).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.locator("p").filter({ hasText: /answered/i })
    ).toBeVisible();
  });

  test("submit diagnostic and see prerequisite breakdown", async ({
    page,
  }) => {
    const course = await createReadyCourse(page);

    // Pre-generate diagnostic via API
    await page.request.post("/api/generate/diagnostic", {
      headers: { "x-api-key": "test-key" },
      data: { courseId: course.id, model: "mock" },
    });

    await page.goto(`/courses/${course.id}/diagnostic`);

    // Wait for questions
    await expect(page.getByText("Diagnostic 1:")).toBeVisible({
      timeout: 15000,
    });

    // Answer all questions — click each choice div to toggle (Radix Checkbox)
    const checkboxes = page.getByRole("checkbox");
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).click();
    }

    // Submit
    await page.getByRole("button", { name: /Submit/i }).click();

    // Should show results with prerequisite breakdown
    await expect(page.getByText(/correct/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Prerequisite Breakdown")).toBeVisible();
  });

  test("skip diagnostic navigates to course", async ({ page }) => {
    const course = await createReadyCourse(page);
    await page.goto(`/courses/${course.id}/diagnostic`);

    // Wait for the page to load
    await expect(
      page.getByText("Prerequisite Assessment")
    ).toBeVisible({ timeout: 15000 });

    // Click skip button (it's a Button with router.push, not a Link)
    await page.getByRole("button", { name: /Skip/i }).click();
    await page.waitForURL(`/courses/${course.id}`, { timeout: 10000 });
  });
});
