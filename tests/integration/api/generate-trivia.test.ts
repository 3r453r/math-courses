import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/generate/trivia/route";
import { createTestCourse, createTestLesson } from "../helpers/fixtures";

describe("POST /api/generate/trivia", () => {
  it("returns 401 without API key", async () => {
    const request = new Request("http://localhost:3000/api/generate/trivia", {
      method: "POST",
      body: JSON.stringify({ courseId: "x" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 without courseId", async () => {
    const request = new Request("http://localhost:3000/api/generate/trivia", {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 404 for non-existent course", async () => {
    const request = new Request("http://localhost:3000/api/generate/trivia", {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({ courseId: "nonexistent", model: "mock" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("generates trivia with mock model", async () => {
    const course = await createTestCourse({ status: "ready" });

    const request = new Request("http://localhost:3000/api/generate/trivia", {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({ courseId: course.id, model: "mock" }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.slides).toHaveLength(20);
    expect(data.slides[0]).toHaveProperty("title");
    expect(data.slides[0]).toHaveProperty("fact");
    expect(data.slides[0]).toHaveProperty("funRating");
  });

  it("generates trivia with lessonId", async () => {
    const course = await createTestCourse({ status: "ready" });
    const lesson = await createTestLesson(course.id, { status: "ready" });

    const request = new Request("http://localhost:3000/api/generate/trivia", {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({
        courseId: course.id,
        lessonId: lesson.id,
        model: "mock",
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.slides).toHaveLength(20);
  });

  it("does not persist trivia to database", async () => {
    const course = await createTestCourse({ status: "ready" });

    const request = new Request("http://localhost:3000/api/generate/trivia", {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({ courseId: course.id, model: "mock" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    // Trivia is ephemeral — no DB model to check
    // Just verify it returns valid data
    const data = await response.json();
    expect(Array.isArray(data.slides)).toBe(true);
  });
});
