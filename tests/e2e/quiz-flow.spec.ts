import { test, expect } from "@playwright/test";
import { seedMockMode } from "./helpers/seed";

test.describe("Quiz Flow", () => {
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

  test("generate quiz and see questions", async ({ page }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}/quiz`);

    // Wait for the page to load and generate button to appear
    const generateBtn = page.getByRole("button", { name: /Generate Quiz/i });
    await generateBtn.waitFor({ timeout: 15000 });
    await generateBtn.click();

    // Wait for questions to appear
    await expect(page.getByText("Q1", { exact: true })).toBeVisible({ timeout: 15000 });

    // Should see progress area
    await expect(
      page.locator("p").filter({ hasText: /answered/i })
    ).toBeVisible();

    // Answer first question by clicking first choice (Radix Checkbox)
    const firstCheckbox = page.getByRole("checkbox").first();
    await firstCheckbox.click();
  });

  test("submit quiz and see results", async ({ page }) => {
    const { courseId, lessonId } = await createReadyLesson(page);

    // Pre-generate quiz via API so the page doesn't need to generate it
    await page.request.post("/api/generate/quiz", {
      headers: { "x-api-key": "test-key" },
      data: { lessonId, courseId, model: "mock" },
    });

    await page.goto(`/courses/${courseId}/lessons/${lessonId}/quiz`);

    // Wait for questions to appear
    await expect(page.getByText("Q1", { exact: true })).toBeVisible({ timeout: 15000 });

    // Answer all questions — click each checkbox (Radix Checkbox)
    const checkboxes = page.getByRole("checkbox");
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).click();
    }

    // Submit
    const submitBtn = page.getByRole("button", { name: /Submit Quiz/i }).first();
    await submitBtn.click();

    // Should show results
    await expect(page.getByText(/correct/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Topic Breakdown")).toBeVisible();
  });
});
