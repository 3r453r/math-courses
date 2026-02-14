import { test, expect } from "@playwright/test";
import { seedMockMode } from "./helpers/seed";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await seedMockMode(page);
  });

  test("shows empty state with Create Your First Course CTA", async ({
    page,
  }) => {
    // Delete any courses created by parallel tests (shared DB)
    const res = await page.request.get("/api/courses");
    const courses = await res.json();
    for (const course of courses) {
      await page.request.delete(`/api/courses/${course.id}`);
    }

    await page.goto("/");
    await expect(
      page.getByText("Welcome to Learning Courses")
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: /Create Your First Course/i })
    ).toBeVisible();
  });

  test("New Course button navigates to creation wizard", async ({ page }) => {
    await page.goto("/");
    // Wait for dashboard to actually load (not redirect to setup)
    await expect(page.getByText("Learning Courses")).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: /New Course/i }).click();
    await page.waitForURL("/courses/new");
  });

  test("Settings button navigates to setup page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Learning Courses")).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: /Settings/i }).click();
    await page.waitForURL("/setup");
  });
});
