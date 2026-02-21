import { test, expect } from "@playwright/test";
import { seedMockMode } from "./helpers/seed";

test.describe("Visualization Regeneration", () => {
  test.beforeEach(async ({ page }) => {
    await seedMockMode(page);
  });

  async function setupLessonWithContent(page: import("@playwright/test").Page) {
    // Create course
    const courseRes = await page.request.post("/api/courses", {
      data: { title: "Viz Test Course", description: "Testing viz regen", topic: "Math" },
    });
    const course = await courseRes.json();

    // Generate course structure (mock)
    await page.request.post("/api/generate/course", {
      headers: { "x-api-key": "test-key" },
      data: { courseId: course.id, topic: "Math", model: "mock" },
    });

    const detail = await (await page.request.get(`/api/courses/${course.id}`)).json();
    const lessonId = detail.lessons[0].id;

    // Generate lesson content (mock)
    await page.request.post("/api/generate/lesson", {
      headers: { "x-api-key": "test-key" },
      data: { lessonId, courseId: course.id, model: "mock" },
    });

    return { courseId: course.id, lessonId };
  }

  test("shows Regenerate visualization button below each viz", async ({ page }) => {
    const { courseId, lessonId } = await setupLessonWithContent(page);

    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);

    // Wait for content to load
    await expect(page.getByText("mock generated content")).toBeVisible({ timeout: 15000 });

    // The mock lesson has a visualization section — button should appear
    await expect(
      page.getByRole("button", { name: /Regenerate visualization/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("clicking button opens modal with caption", async ({ page }) => {
    const { courseId, lessonId } = await setupLessonWithContent(page);

    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({ timeout: 15000 });

    // Click the Regenerate viz button
    await page.getByRole("button", { name: /Regenerate visualization/i }).first().click();

    // Modal should open
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("heading", { name: "Regenerate Visualization" })).toBeVisible();

    // Caption should be shown in modal context
    await expect(
      page.getByRole("dialog").getByText("A simple function plot for testing visualization rendering.")
    ).toBeVisible();
  });

  test("submitting modal calls API and shows success toast", async ({ page }) => {
    const { courseId, lessonId } = await setupLessonWithContent(page);

    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({ timeout: 15000 });

    // Open modal
    await page.getByRole("button", { name: /Regenerate visualization/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });

    // Fill in optional feedback
    await page.getByPlaceholder(/labels overlap/i).fill("y-axis labels overlap");

    // Click Regenerate in modal
    await page.getByRole("dialog").getByRole("button", { name: /Regenerate visualization/i }).click();

    // Modal should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3000 });

    // Success toast should appear
    await expect(page.getByText(/Visualization regenerated/i)).toBeVisible({ timeout: 10000 });

    // Caption <p> should be updated (mock appends "(mock regenerated)")
    await expect(
      page.locator("p.text-muted-foreground", { hasText: /mock regenerated/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("cancel button closes modal without regenerating", async ({ page }) => {
    const { courseId, lessonId } = await setupLessonWithContent(page);

    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: /Regenerate visualization/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });

    // Track API calls — cancel should not trigger any
    const apiCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/generate/visualization")) apiCalls.push(req.url());
    });

    await page.getByRole("dialog").getByRole("button", { name: /cancel/i }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3000 });
    expect(apiCalls).toHaveLength(0);
  });
});
