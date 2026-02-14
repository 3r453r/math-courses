import { test, expect } from "@playwright/test";

test.describe("Setup Flow", () => {
  test("renders setup page with API key form", async ({ page }) => {
    await page.goto("/setup");

    await expect(page.locator("#api-key")).toBeVisible();
    await expect(
      page.getByText("Generation Model (lessons, quizzes)")
    ).toBeVisible();
    await expect(page.getByText("Chat Model (AI sidebar)")).toBeVisible();
  });

  test("Save & Continue stores key and redirects to dashboard", async ({
    page,
  }) => {
    await page.goto("/setup");

    // Fill in API key
    await page.locator("#api-key").fill("sk-ant-test-key");

    // Select mock model — it's a shadcn/radix Select, click the trigger then option
    const genModelTrigger = page.locator("#gen-model");
    await genModelTrigger.click();
    await page.getByRole("option", { name: /Mock/i }).click();

    // Click Save & Continue
    await page.getByRole("button", { name: "Save & Continue" }).click();

    // Should redirect to dashboard
    await page.waitForURL("/", { timeout: 10000 });
    await expect(page.getByText("Learning Courses")).toBeVisible();
  });

  test("Test Key and Save & Continue buttons are visible", async ({
    page,
  }) => {
    await page.goto("/setup");

    await expect(
      page.getByRole("button", { name: "Test Key" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save & Continue" })
    ).toBeVisible();
  });
});
