import { test, expect } from "@playwright/test";

test.describe("Setup Flow", () => {
  test("renders setup page with API key form", async ({ page }) => {
    await page.goto("/setup");

    await expect(page.locator("#key-anthropic")).toBeVisible();
    await expect(
      page.getByText("Generation Model (lessons, quizzes)")
    ).toBeVisible();
    await expect(page.getByText("Chat Model (AI sidebar)")).toBeVisible();
  });

  test("Save & Continue stores key and redirects to dashboard", async ({
    page,
  }) => {
    await page.goto("/setup");

    // Fill in Anthropic API key (first provider accordion)
    await page.locator("#key-anthropic").fill("sk-ant-test-key");

    // Select mock model — it's a shadcn/radix Select, click the trigger then option
    const genModelTrigger = page.locator("#gen-model");
    await genModelTrigger.click();
    await page.getByRole("option", { name: /Mock/i }).click();

    // Click Save & Continue
    await page.getByRole("button", { name: "Save & Continue" }).click();

    // Should redirect to dashboard
    await page.waitForURL("/", { timeout: 10000 });
    await expect(page.getByText("StemForge")).toBeVisible();
  });

  test("Test and Save & Continue buttons are visible", async ({
    page,
  }) => {
    await page.goto("/setup");

    await expect(
      page.getByRole("button", { name: "Test" }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save & Continue" })
    ).toBeVisible();
  });
});
