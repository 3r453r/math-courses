import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/generate/quiz/route";
import { createTestCourse, createTestLesson } from "../helpers/fixtures";
import { getTestPrisma } from "../helpers/db";

describe("POST /api/generate/quiz", () => {
  it("returns 401 without API key", async () => {
    const request = new Request("http://localhost:3000/api/generate/quiz", {
      method: "POST",
      body: JSON.stringify({ lessonId: "x", courseId: "y" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 without required fields", async () => {
    const request = new Request("http://localhost:3000/api/generate/quiz", {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 404 for non-existent lesson", async () => {
    const request = new Request("http://localhost:3000/api/generate/quiz", {
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

  it("generates quiz with mock model", async () => {
    const course = await createTestCourse({ status: "ready" });
    const lesson = await createTestLesson(course.id, { status: "ready" });

    const request = new Request("http://localhost:3000/api/generate/quiz", {
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
    expect(data.status).toBe("ready");
    expect(data.questionCount).toBe(10);
  });

  it("creates quiz record in DB", async () => {
    const prisma = getTestPrisma();
    const course = await createTestCourse({ status: "ready" });
    const lesson = await createTestLesson(course.id, { status: "ready" });

    const request = new Request("http://localhost:3000/api/generate/quiz", {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({
        lessonId: lesson.id,
        courseId: course.id,
        model: "mock",
      }),
    });

    await POST(request);

    const quizzes = await prisma.quiz.findMany({
      where: { lessonId: lesson.id },
    });
    expect(quizzes).toHaveLength(1);
    expect(quizzes[0].status).toBe("ready");
  });

  it("returns existing quiz if already ready (idempotent)", async () => {
    const course = await createTestCourse({ status: "ready" });
    const lesson = await createTestLesson(course.id, { status: "ready" });

    const makeRequest = () =>
      new Request("http://localhost:3000/api/generate/quiz", {
        method: "POST",
        headers: { "x-api-key": "test-key" },
        body: JSON.stringify({
          lessonId: lesson.id,
          courseId: course.id,
          model: "mock",
        }),
      });

    // First call creates
    const response1 = await POST(makeRequest());
    const data1 = await response1.json();

    // Second call returns existing
    const response2 = await POST(makeRequest());
    const data2 = await response2.json();

    expect(data1.id).toBe(data2.id);
  });
});
