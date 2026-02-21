import { test, expect, Page } from "@playwright/test";
import { seedMockMode } from "./helpers/seed";

test.describe("Chat panel scroll behavior", () => {
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

  /** The desktop chat aside contains the chat-messages-container */
  function desktopChatContainer(page: Page) {
    return page
      .locator("[data-testid='chat-aside']")
      .locator("[data-testid='chat-messages-container']");
  }

  test("chat auto-scrolls to bottom when user is at bottom", async ({
    page,
  }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Open chat panel
    await page.getByRole("button", { name: /Chat/i }).click();
    await page
      .locator("[data-testid='chat-aside']")
      .waitFor({ timeout: 5000 });

    // Send a message
    const chatInput = page
      .locator("[data-testid='chat-aside']")
      .getByRole("textbox");
    await chatInput.fill("Explain functions");
    await chatInput.press("Enter");

    // Wait for response to appear (mock returns plain text with "Key Idea")
    await expect(
      page.locator("[data-testid='chat-aside']").getByText("Key Idea")
    ).toBeVisible({ timeout: 15000 });

    // Container should be scrolled to bottom
    const container = desktopChatContainer(page);
    const isNearBottom = await container.evaluate((el) => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      return distFromBottom < 100;
    });
    expect(isNearBottom).toBe(true);
  });

  test("scroll-to-bottom button appears when scrolled up", async ({
    page,
  }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Open chat
    await page.getByRole("button", { name: /Chat/i }).click();
    await page
      .locator("[data-testid='chat-aside']")
      .waitFor({ timeout: 5000 });

    // Inject many messages to make the container scrollable
    const container = desktopChatContainer(page);
    await container.evaluate((el) => {
      for (let i = 0; i < 30; i++) {
        const div = document.createElement("div");
        div.className = "p-3 rounded bg-muted";
        div.textContent = `Test message ${i + 1} - padding content to fill the container`;
        // Insert before the scroll sentinel (last child)
        el.insertBefore(div, el.lastElementChild);
      }
    });

    // Scroll to bottom first (to establish baseline), then scroll up
    await container.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(100);
    await container.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(200);

    // Scroll-to-bottom button should appear (in the desktop aside)
    const scrollBtn = page
      .locator("[data-testid='chat-aside']")
      .locator("[data-testid='scroll-to-bottom']");
    await expect(scrollBtn).toBeVisible({ timeout: 3000 });
  });

  test("scroll-to-bottom button jumps to bottom when clicked", async ({
    page,
  }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Open chat
    await page.getByRole("button", { name: /Chat/i }).click();
    await page
      .locator("[data-testid='chat-aside']")
      .waitFor({ timeout: 5000 });

    // Inject messages and scroll up
    const container = desktopChatContainer(page);
    await container.evaluate((el) => {
      for (let i = 0; i < 30; i++) {
        const div = document.createElement("div");
        div.className = "p-3 rounded bg-muted";
        div.textContent = `Test message ${i + 1} - padding content`;
        el.insertBefore(div, el.lastElementChild);
      }
    });
    await container.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(100);
    await container.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(200);

    // Click scroll-to-bottom button
    const scrollBtn = page
      .locator("[data-testid='chat-aside']")
      .locator("[data-testid='scroll-to-bottom']");
    await scrollBtn.click();
    await page.waitForTimeout(500);

    // Should be near bottom
    const isNearBottom = await container.evaluate((el) => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      return distFromBottom < 100;
    });
    expect(isNearBottom).toBe(true);

    // Button should disappear
    await expect(scrollBtn).not.toBeVisible();
  });

  test("sending a message auto-scrolls even when scrolled up", async ({
    page,
  }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Open chat
    await page.getByRole("button", { name: /Chat/i }).click();
    await page
      .locator("[data-testid='chat-aside']")
      .waitFor({ timeout: 5000 });

    // Send first message to get some content
    const chatInput = page
      .locator("[data-testid='chat-aside']")
      .getByRole("textbox");
    await chatInput.fill("First question");
    await chatInput.press("Enter");
    await expect(
      page.locator("[data-testid='chat-aside']").getByText("Key Idea")
    ).toBeVisible({ timeout: 15000 });

    // Inject more messages to make scrollable
    const container = desktopChatContainer(page);
    await container.evaluate((el) => {
      for (let i = 0; i < 20; i++) {
        const div = document.createElement("div");
        div.className = "p-3 rounded bg-muted";
        div.textContent = `Filler message ${i + 1}`;
        el.insertBefore(div, el.lastElementChild);
      }
    });

    // Scroll up
    await container.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(200);

    // Send a new message — should auto-scroll to bottom
    await chatInput.fill("Another question");
    await chatInput.press("Enter");

    // Wait for the auto-scroll to complete (smooth scroll + setTimeout)
    await expect
      .poll(
        async () => {
          return container.evaluate((el) => {
            const distFromBottom =
              el.scrollHeight - el.scrollTop - el.clientHeight;
            return distFromBottom < 150;
          });
        },
        { timeout: 5000, message: "Should auto-scroll to bottom after sending" }
      )
      .toBe(true);
  });
});
