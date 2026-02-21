import { test, expect, Page } from "@playwright/test";
import { seedMockMode } from "./helpers/seed";

test.describe("Lesson interactions - Copy LaTeX & Ask AI", () => {
  test.beforeEach(async ({ page }) => {
    await seedMockMode(page);
  });

  async function createReadyLesson(page: Page) {
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

  test("copy LaTeX button appears on hover of math block", async ({
    page,
  }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Find the KaTeX block copy button (first one is on the display math in text section)
    const copyButton = page.locator("[data-testid='copy-latex-button']").first();

    // Button should exist but be invisible (opacity-0)
    await expect(copyButton).toBeAttached();

    // Hover the parent container to reveal it
    const mathBlock = copyButton.locator("..");
    await mathBlock.hover();
    await expect(copyButton).toBeVisible();
  });

  test("clicking copy button copies LaTeX to clipboard", async ({
    page,
    context,
  }) => {
    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Hover over math block to reveal copy button
    const copyButton = page.locator("[data-testid='copy-latex-button']").first();
    const mathBlock = copyButton.locator("..");
    await mathBlock.hover();
    await expect(copyButton).toBeVisible();

    // Click copy
    await copyButton.click();

    // Read clipboard
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText()
    );

    // Should contain the raw LaTeX (Euler's identity from mock data)
    expect(clipboardText).toContain("e^{i\\pi} + 1 = 0");
  });

  test("Ask AI button visible on definition section", async ({ page }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Mock data has a "Mock Data" definition
    await expect(page.getByText("Mock Data").first()).toBeVisible();

    // Find the Ask AI button near the definition
    const askAiButtons = page.locator("[data-testid='ask-ai-button']");
    await expect(askAiButtons.first()).toBeVisible();
  });

  test("clicking Ask AI opens chat panel with pre-filled input", async ({
    page,
  }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Click the first Ask AI button (on the definition section)
    const askAiButton = page.locator("[data-testid='ask-ai-button']").first();
    await askAiButton.click();

    // Chat panel should open
    await page
      .locator("[data-testid='chat-aside']")
      .waitFor({ timeout: 5000 });

    // Chat input should be pre-filled with context about the definition
    const chatInput = page
      .locator("[data-testid='chat-aside']")
      .getByRole("textbox");
    await expect
      .poll(
        async () => chatInput.inputValue(),
        { timeout: 5000, message: "Input should contain definition context" }
      )
      .toContain("definition");
  });

  test("Ask AI preserves existing chat history", async ({ page }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Open chat and send a message first
    await page.getByRole("button", { name: /Chat/i }).click();
    await page
      .locator("[data-testid='chat-aside']")
      .waitFor({ timeout: 5000 });

    const chatInput = page
      .locator("[data-testid='chat-aside']")
      .getByRole("textbox");
    await chatInput.fill("What is calculus?");
    await chatInput.press("Enter");

    // Wait for response
    await expect(
      page.locator("[data-testid='chat-aside']").getByText("Key Idea")
    ).toBeVisible({ timeout: 15000 });

    // Close chat
    await page.getByRole("button", { name: /Chat/i }).click();
    await page.waitForTimeout(300);

    // Click Ask AI on a section
    const askAiButton = page.locator("[data-testid='ask-ai-button']").first();
    await askAiButton.click();

    // Chat panel should reopen
    await page
      .locator("[data-testid='chat-aside']")
      .waitFor({ timeout: 5000 });

    // Previous messages should still be visible (loaded from DB)
    await expect(
      page.locator("[data-testid='chat-aside']").getByText("What is calculus?")
    ).toBeVisible({ timeout: 5000 });

    // And input should be pre-filled
    await expect
      .poll(
        async () => (await chatInput.inputValue()).length,
        { timeout: 5000, message: "Input should be pre-filled" }
      )
      .toBeGreaterThan(0);
  });
});
