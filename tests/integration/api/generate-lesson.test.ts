import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/generate/lesson/route";
import { createTestCourse, createTestLesson } from "../helpers/fixtures";
import { getTestPrisma } from "../helpers/db";

describe("POST /api/generate/lesson", () => {
  it("returns 401 without API key", async () => {
    const request = new Request("http://localhost:3000/api/generate/lesson", {
      method: "POST",
      body: JSON.stringify({ lessonId: "x", courseId: "y" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 without lessonId or courseId", async () => {
    const request = new Request("http://localhost:3000/api/generate/lesson", {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 404 for non-existent lesson", async () => {
    const request = new Request("http://localhost:3000/api/generate/lesson", {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({
        lessonId: "nonexistent",
        courseId: "nonexistent",
        model: "mock",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("generates lesson content with mock model", async () => {
    const course = await createTestCourse({ status: "ready" });
    const lesson = await createTestLesson(course.id, { status: "pending" });

    const request = new Request("http://localhost:3000/api/generate/lesson", {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({
        lessonId: lesson.id,
        courseId: course.id,
        model: "mock",
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.lesson).toBeDefined();
    expect(data.lesson.title).toBeTruthy();
    expect(data.lesson.sections).toBeDefined();
    expect(Array.isArray(data.lesson.sections)).toBe(true);
    expect(data.quiz).toBeDefined();
    expect(data.quiz.questions).toBeDefined();
    expect(Array.isArray(data.quiz.questions)).toBe(true);
  });

  it("stores contentJson and updates status to ready", async () => {
    const prisma = getTestPrisma();
    const course = await createTestCourse({ status: "ready" });
    const lesson = await createTestLesson(course.id, { status: "pending" });

    const request = new Request("http://localhost:3000/api/generate/lesson", {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({
        lessonId: lesson.id,
        courseId: course.id,
        model: "mock",
      }),
    });

    await POST(request);

    const updated = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });
    expect(updated?.status).toBe("ready");
    expect(updated?.contentJson).toBeTruthy();
    const content = JSON.parse(updated!.contentJson!);
    expect(content.title).toBeTruthy();

    // Verify co-generated quiz was saved
    const quiz = await prisma.quiz.findFirst({
      where: { lessonId: lesson.id },
    });
    expect(quiz).toBeTruthy();
    expect(quiz?.status).toBe("ready");
    expect(quiz?.questionCount).toBeGreaterThan(0);
  });
});
