import { test, expect } from "@playwright/test";
import { seedMockMode } from "./helpers/seed";

test.describe("Lesson Viewing", () => {
  test.beforeEach(async ({ page }) => {
    await seedMockMode(page);
  });

  async function createCourseWithLesson(
    page: import("@playwright/test").Page
  ) {
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
    return { course: detail, lessonId: detail.lessons[0].id };
  }

  test("shows Generate button for pending lesson", async ({ page }) => {
    const { course, lessonId } = await createCourseWithLesson(page);
    await page.goto(`/courses/${course.id}/lessons/${lessonId}`);

    await expect(
      page.getByRole("button", { name: /Generate Lesson Content/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("generates and renders lesson content", async ({ page }) => {
    const { course, lessonId } = await createCourseWithLesson(page);
    await page.goto(`/courses/${course.id}/lessons/${lessonId}`);

    // Click generate
    const generateBtn = page.getByRole("button", {
      name: /Generate Lesson Content/i,
    });
    await generateBtn.waitFor({ timeout: 15000 });
    await generateBtn.click();

    // Wait for content to render — text from first mock section
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });
  });

  test("scratchpad toggle opens panel", async ({ page }) => {
    const { course, lessonId } = await createCourseWithLesson(page);

    // Generate lesson first via API
    await page.request.post("/api/generate/lesson", {
      headers: { "x-api-key": "test-key" },
      data: { lessonId, courseId: course.id, model: "mock" },
    });

    await page.goto(`/courses/${course.id}/lessons/${lessonId}`);

    // Wait for content to load
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Click scratchpad button
    const scratchpadBtn = page.getByRole("button", { name: /Scratchpad/i });
    await scratchpadBtn.click();

    // Scratchpad panel should be visible — look for the textarea
    await expect(page.locator("textarea").first()).toBeVisible({
      timeout: 5000,
    });
  });
});
