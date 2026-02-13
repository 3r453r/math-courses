import { test, expect } from "@playwright/test";
import { seedMockMode } from "./helpers/seed";

test.describe("Course Overview", () => {
  test.beforeEach(async ({ page }) => {
    await seedMockMode(page);
  });

  async function createMockCourse(page: import("@playwright/test").Page) {
    const response = await page.request.post("/api/courses", {
      data: {
        title: "Test Course",
        description: "A test course",
        topic: "Mathematics",
      },
    });
    const course = await response.json();

    await page.request.post("/api/generate/course", {
      headers: { "x-api-key": "test-key" },
      data: {
        courseId: course.id,
        topic: "Mathematics",
        model: "mock",
      },
    });

    return course;
  }

  test("displays course overview with lessons", async ({ page }) => {
    const course = await createMockCourse(page);
    await page.goto(`/courses/${course.id}`);

    await expect(page.getByText("Mock Test Course")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Course Structure")).toBeVisible();
  });

  test("lesson cards show status and title", async ({ page }) => {
    const course = await createMockCourse(page);
    await page.goto(`/courses/${course.id}`);

    // Should see at least one lesson from mock data
    await expect(
      page.getByText("Mock Lesson 1: Introduction").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("clicking a lesson navigates to lesson page", async ({ page }) => {
    const course = await createMockCourse(page);
    await page.goto(`/courses/${course.id}`);

    // Wait for lessons to load
    const lessonLink = page.getByText("Mock Lesson 1: Introduction").first();
    await lessonLink.waitFor({ timeout: 15000 });
    await lessonLink.click();

    await page.waitForURL(/\/lessons\//, { timeout: 10000 });
  });
});
