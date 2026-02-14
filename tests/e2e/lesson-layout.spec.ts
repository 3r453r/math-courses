import { test, expect, Page } from "@playwright/test";
import { seedMockMode } from "./helpers/seed";

test.describe("Lesson page layout - single scrollbar", () => {
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

  /**
   * Verify no document-level scrollbar can appear.
   * The lesson page wrapper uses position:fixed which takes it out of
   * document flow entirely — the body has no in-flow content to scroll.
   */
  async function assertNoDocumentScrollbar(page: Page) {
    const position = await page
      .locator("[data-testid='lesson-page-wrapper']")
      .evaluate((el) => window.getComputedStyle(el).position);
    expect(position).toBe("fixed");
  }

  test("panels closed: wrapper is overflow-hidden, container scrolls", async ({
    page,
  }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Wrapper prevents body-level scrollbar
    await assertNoDocumentScrollbar(page);

    // The scroll container should have overflow-y: auto (it IS the scroll area)
    const containerOverflow = await page
      .locator("[data-testid='lesson-scroll-container']")
      .evaluate((el) => window.getComputedStyle(el).overflowY);
    expect(containerOverflow).toBe("auto");
  });

  test("scratchpad open: wrapper is overflow-hidden, only main scrolls", async ({
    page,
  }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Open scratchpad
    await page.getByRole("button", { name: /Scratchpad/i }).click();
    await page
      .locator("[data-testid='scratchpad-aside']")
      .waitFor({ timeout: 5000 });

    // Wrapper prevents body-level scrollbar
    await assertNoDocumentScrollbar(page);

    // Container should NOT scroll (it's a flex parent, no overflow-y-auto)
    const containerOverflow = await page
      .locator("[data-testid='lesson-scroll-container']")
      .evaluate((el) => window.getComputedStyle(el).overflowY);
    expect(containerOverflow).not.toBe("auto");
    expect(containerOverflow).not.toBe("scroll");

    // Main should have overflow-y: auto (it IS the scroll area)
    const mainOverflow = await page
      .locator("[data-testid='lesson-main']")
      .evaluate((el) => window.getComputedStyle(el).overflowY);
    expect(mainOverflow).toBe("auto");
  });

  test("chat panel open: wrapper is overflow-hidden, only main scrolls", async ({
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

    // Wrapper prevents body-level scrollbar
    await assertNoDocumentScrollbar(page);

    // Container should NOT scroll
    const containerOverflow = await page
      .locator("[data-testid='lesson-scroll-container']")
      .evaluate((el) => window.getComputedStyle(el).overflowY);
    expect(containerOverflow).not.toBe("auto");
    expect(containerOverflow).not.toBe("scroll");

    // Main should have overflow-y: auto
    const mainOverflow = await page
      .locator("[data-testid='lesson-main']")
      .evaluate((el) => window.getComputedStyle(el).overflowY);
    expect(mainOverflow).toBe("auto");
  });

  test("panels closed: scrolling works in container", async ({ page }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Inject tall content to force scrolling
    await page
      .locator("[data-testid='lesson-scroll-container']")
      .evaluate((el) => {
        const spacer = document.createElement("div");
        spacer.style.height = "5000px";
        el.querySelector("main")?.appendChild(spacer);
      });

    const container = page.locator("[data-testid='lesson-scroll-container']");

    // Container should be scrollable now
    const isScrollable = await container.evaluate(
      (el) => el.scrollHeight > el.clientHeight
    );
    expect(isScrollable).toBe(true);

    // Scroll down
    await container.evaluate((el) => {
      el.scrollTop = 500;
    });
    await page.waitForTimeout(100);

    const scrollTop = await container.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);

    // Wrapper still prevents body scrollbar
    await assertNoDocumentScrollbar(page);
  });

  test("scratchpad open: scrolling main works, aside stays fixed", async ({
    page,
  }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Open scratchpad
    await page.getByRole("button", { name: /Scratchpad/i }).click();
    const aside = page.locator("[data-testid='scratchpad-aside']");
    await aside.waitFor({ timeout: 5000 });

    // Inject tall content into main to force scrolling
    await page.locator("[data-testid='lesson-main']").evaluate((el) => {
      const spacer = document.createElement("div");
      spacer.style.height = "5000px";
      el.appendChild(spacer);
    });

    const main = page.locator("[data-testid='lesson-main']");

    // Main should be scrollable
    const isScrollable = await main.evaluate(
      (el) => el.scrollHeight > el.clientHeight
    );
    expect(isScrollable).toBe(true);

    // Get aside initial position
    const initialTop = await aside.evaluate(
      (el) => el.getBoundingClientRect().top
    );

    // Scroll main
    await main.evaluate((el) => {
      el.scrollTop = 500;
    });
    await page.waitForTimeout(100);

    const mainScrollTop = await main.evaluate((el) => el.scrollTop);
    expect(mainScrollTop).toBeGreaterThan(0);

    // Aside should NOT have moved
    const afterTop = await aside.evaluate(
      (el) => el.getBoundingClientRect().top
    );
    expect(afterTop).toBe(initialTop);

    // Wrapper still prevents body scrollbar
    await assertNoDocumentScrollbar(page);
  });

  test("switching panels preserves lesson scroll position", async ({
    page,
  }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Open scratchpad
    await page.getByRole("button", { name: /Scratchpad/i }).click();
    await page
      .locator("[data-testid='scratchpad-aside']")
      .waitFor({ timeout: 5000 });

    // Inject tall content into main
    await page.locator("[data-testid='lesson-main']").evaluate((el) => {
      const spacer = document.createElement("div");
      spacer.style.height = "5000px";
      el.appendChild(spacer);
    });

    // Scroll main down
    const main = page.locator("[data-testid='lesson-main']");
    await main.evaluate((el) => {
      el.scrollTop = 2000;
    });
    await page.waitForTimeout(100);
    const scrolledPos = await main.evaluate((el) => el.scrollTop);
    expect(scrolledPos).toBeGreaterThan(0);

    // Switch to chat panel
    await page.getByRole("button", { name: /Chat/i }).click();
    await page
      .locator("[data-testid='chat-aside']")
      .waitFor({ timeout: 5000 });
    await page.waitForTimeout(200);

    // Main scroll position should be preserved
    const afterSwitch = await main.evaluate((el) => el.scrollTop);
    expect(afterSwitch).toBe(scrolledPos);
  });

  test("header stays visible when scrolled with panel open", async ({
    page,
  }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Open scratchpad and inject tall content
    await page.getByRole("button", { name: /Scratchpad/i }).click();
    await page
      .locator("[data-testid='scratchpad-aside']")
      .waitFor({ timeout: 5000 });

    await page.locator("[data-testid='lesson-main']").evaluate((el) => {
      const spacer = document.createElement("div");
      spacer.style.height = "5000px";
      el.appendChild(spacer);
    });

    // Scroll main all the way down
    await page.locator("[data-testid='lesson-main']").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(100);

    // Header buttons should still be visible and clickable
    await expect(
      page.getByRole("button", { name: /Chat/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Scratchpad/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Course Overview/i })
    ).toBeVisible();
  });

  test("header stays visible when scrolled with no panel", async ({
    page,
  }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Inject tall content into container
    await page
      .locator("[data-testid='lesson-scroll-container']")
      .evaluate((el) => {
        const spacer = document.createElement("div");
        spacer.style.height = "5000px";
        el.querySelector("main")?.appendChild(spacer);
      });

    // Scroll container all the way down
    await page
      .locator("[data-testid='lesson-scroll-container']")
      .evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
    await page.waitForTimeout(100);

    // Header buttons should still be visible
    await expect(
      page.getByRole("button", { name: /Chat/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Scratchpad/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Course Overview/i })
    ).toBeVisible();
  });

  test("navigate away and back starts at top", async ({ page }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Inject tall content and scroll down
    await page
      .locator("[data-testid='lesson-scroll-container']")
      .evaluate((el) => {
        const spacer = document.createElement("div");
        spacer.style.height = "5000px";
        el.querySelector("main")?.appendChild(spacer);
      });
    await page
      .locator("[data-testid='lesson-scroll-container']")
      .evaluate((el) => {
        el.scrollTop = 2000;
      });
    await page.waitForTimeout(100);

    // Navigate to course overview
    await page.getByRole("button", { name: /Course Overview/i }).click();
    await page.waitForURL(`**/courses/${courseId}`);

    // Navigate back to lesson
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Header must be visible (not scrolled off)
    await expect(
      page.getByRole("button", { name: /Course Overview/i })
    ).toBeVisible();

    // Document should not be scrolled
    const docScroll = await page.evaluate(
      () => document.documentElement.scrollTop + document.body.scrollTop
    );
    expect(docScroll).toBe(0);
  });

  test("only one side panel open at a time", async ({ page }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    // Open scratchpad
    await page.getByRole("button", { name: /Scratchpad/i }).click();
    await page
      .locator("[data-testid='scratchpad-aside']")
      .waitFor({ timeout: 5000 });

    // Open chat — scratchpad should close
    await page.getByRole("button", { name: /Chat/i }).click();
    await page
      .locator("[data-testid='chat-aside']")
      .waitFor({ timeout: 5000 });
    await expect(
      page.locator("[data-testid='scratchpad-aside']")
    ).not.toBeVisible();

    // Open scratchpad — chat should close
    await page.getByRole("button", { name: /Scratchpad/i }).click();
    await page
      .locator("[data-testid='scratchpad-aside']")
      .waitFor({ timeout: 5000 });
    await expect(
      page.locator("[data-testid='chat-aside']")
    ).not.toBeVisible();
  });

  test("closing panel restores full-width layout", async ({ page }) => {
    const { courseId, lessonId } = await createReadyLesson(page);
    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await expect(page.getByText("mock generated content")).toBeVisible({
      timeout: 15000,
    });

    const main = page.locator("[data-testid='lesson-main']");

    // Panels closed — main should be full width (no w-1/2)
    const fullWidth = await main.evaluate((el) => el.offsetWidth);

    // Open scratchpad — main should be roughly half width
    await page.getByRole("button", { name: /Scratchpad/i }).click();
    await page
      .locator("[data-testid='scratchpad-aside']")
      .waitFor({ timeout: 5000 });
    const halfWidth = await main.evaluate((el) => el.offsetWidth);
    expect(halfWidth).toBeLessThan(fullWidth * 0.75);

    // Close scratchpad — main should return to full width
    await page.getByRole("button", { name: /Scratchpad/i }).click();
    await page.waitForTimeout(200);
    const restoredWidth = await main.evaluate((el) => el.offsetWidth);
    expect(restoredWidth).toBeGreaterThan(halfWidth);
  });
});
