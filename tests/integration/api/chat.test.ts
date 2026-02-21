import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/chat/route";
import { createTestCourse, createTestLesson } from "../helpers/fixtures";

describe("POST /api/chat (mock mode)", () => {
  it("returns streamed text response with mock model", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id, { status: "ready" });

    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "user", parts: [{ type: "text", text: "Explain functions" }] },
        ],
        lessonId: lesson.id,
        model: "mock",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/plain");

    const text = await response.text();
    // Mock response should contain the medium-length text with LaTeX
    expect(text).toContain("Key Idea");
    expect(text).toContain("f(x)");
  });

  it("returns long response when asked", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id, { status: "ready" });

    const shortRequest = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "user", parts: [{ type: "text", text: "Explain functions" }] },
        ],
        lessonId: lesson.id,
        model: "mock",
      }),
    });

    const longRequest = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "user", parts: [{ type: "text", text: "give me a long response about functions" }] },
        ],
        lessonId: lesson.id,
        model: "mock",
      }),
    });

    const shortResponse = await POST(shortRequest);
    const longResponse = await POST(longRequest);

    const shortText = await shortResponse.text();
    const longText = await longResponse.text();

    // Long response should be significantly longer
    expect(longText.length).toBeGreaterThan(shortText.length);
    // Long response contains unique content
    expect(longText).toContain("Inverse Functions");
  });

  it("does not require API key for mock model", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id, { status: "ready" });

    // No x-api-keys header
    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "user", parts: [{ type: "text", text: "Hello" }] },
        ],
        lessonId: lesson.id,
        model: "mock",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it("extracts last user message from content field", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id, { status: "ready" });

    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "give me a long response" },
        ],
        lessonId: lesson.id,
        model: "mock",
      }),
    });

    const response = await POST(request);
    const text = await response.text();
    // Should trigger the long response
    expect(text).toContain("Inverse Functions");
  });
});
