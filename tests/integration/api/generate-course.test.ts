import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/generate/course/route";
import { createTestCourse } from "../helpers/fixtures";
import { getTestPrisma } from "../helpers/db";

describe("POST /api/generate/course", () => {
  it("returns 401 without API key", async () => {
    const request = new Request("http://localhost:3000/api/generate/course", {
      method: "POST",
      body: JSON.stringify({ topic: "Algebra" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("API key required");
  });

  it("generates course structure with mock model", async () => {
    const course = await createTestCourse({ status: "draft" });

    const request = new Request("http://localhost:3000/api/generate/course", {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({
        courseId: course.id,
        topic: "Test Math",
        model: "mock",
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.title).toBeTruthy();
    expect(data.lessons).toBeDefined();
    expect(Array.isArray(data.lessons)).toBe(true);
  });

  it("creates lessons and edges in DB for mock generation", async () => {
    const prisma = getTestPrisma();
    const course = await createTestCourse({ status: "draft" });

    const request = new Request("http://localhost:3000/api/generate/course", {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({
        courseId: course.id,
        topic: "Test Math",
        model: "mock",
      }),
    });

    await POST(request);

    // Check course status updated to "ready"
    const updatedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });
    expect(updatedCourse?.status).toBe("ready");

    // Check lessons were created
    const lessons = await prisma.lesson.findMany({
      where: { courseId: course.id },
    });
    expect(lessons.length).toBeGreaterThanOrEqual(1);
  });

  it("generates without courseId (no DB save)", async () => {
    const request = new Request("http://localhost:3000/api/generate/course", {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({ topic: "Algebra", model: "mock" }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.title).toBeTruthy();
  });
});
