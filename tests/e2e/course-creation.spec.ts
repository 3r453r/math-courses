import { test, expect } from "@playwright/test";
import { seedMockMode } from "./helpers/seed";

test.describe("Course Creation", () => {
  test.beforeEach(async ({ page }) => {
    await seedMockMode(page);
  });

  test("fills topic form and generates course", async ({ page }) => {
    await page.goto("/courses/new");

    // Step 1: Fill topic
    await page.locator("#topic").fill("Linear Algebra");
    await page.locator("#description").fill(
      "Study of vector spaces and linear transformations"
    );

    // Add a focus area
    await page.locator("#focus").fill("Eigenvalues");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Eigenvalues")).toBeVisible();

    // Navigate to step 2 — use exact:true to avoid matching Next.js dev tools button
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Step 2: Configuration should be visible
    await expect(page.locator("#difficulty")).toBeVisible();

    // Generate course
    await page.getByRole("button", { name: /Generate Course/i }).click();

    // Wait for generation to complete (mock is fast) and redirect
    await page.waitForURL(/\/courses\//, { timeout: 30000 });

    // Should be on course overview with lessons visible
    await expect(page.getByText("Mock Test Course")).toBeVisible({
      timeout: 10000,
    });
  });

  test("Next button is disabled when topic is empty", async ({ page }) => {
    await page.goto("/courses/new");

    const nextButton = page.getByRole("button", {
      name: "Next",
      exact: true,
    });
    await expect(nextButton).toBeDisabled();

    // Fill topic
    await page.locator("#topic").fill("Test Topic");
    await expect(nextButton).toBeEnabled();
  });

  test("can add and remove focus areas", async ({ page }) => {
    await page.goto("/courses/new");

    // Add focus area
    await page.locator("#focus").fill("Matrices");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Matrices")).toBeVisible();

    // Add another
    await page.locator("#focus").fill("Determinants");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Determinants")).toBeVisible();

    // Remove first one — the badge itself is clickable (onClick removes it)
    const matricesBadge = page
      .locator('[data-slot="badge"]')
      .filter({ hasText: "Matrices" });
    await matricesBadge.click();
    await expect(
      page.locator('[data-slot="badge"]').filter({ hasText: "Matrices" })
    ).not.toBeVisible();
    await expect(page.getByText("Determinants")).toBeVisible();
  });
});
