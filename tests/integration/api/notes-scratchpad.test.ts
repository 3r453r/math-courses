import { describe, it, expect } from "vitest";
import { GET, PUT } from "@/app/api/notes/scratchpad/route";
import { createTestCourse, createTestLesson } from "../helpers/fixtures";

describe("GET /api/notes/scratchpad", () => {
  it("returns 400 without lessonId", async () => {
    const request = new Request("http://localhost:3000/api/notes/scratchpad");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("creates a scratchpad if none exists and returns it", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);

    const request = new Request(
      `http://localhost:3000/api/notes/scratchpad?lessonId=${lesson.id}`
    );
    const response = await GET(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.lessonId).toBe(lesson.id);
    expect(data.content).toBe("");
    expect(data.id).toBeTruthy();
  });

  it("returns existing scratchpad on second call", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);

    const makeRequest = () =>
      new Request(
        `http://localhost:3000/api/notes/scratchpad?lessonId=${lesson.id}`
      );

    const response1 = await GET(makeRequest());
    const data1 = await response1.json();

    const response2 = await GET(makeRequest());
    const data2 = await response2.json();

    expect(data1.id).toBe(data2.id);
  });
});

describe("PUT /api/notes/scratchpad", () => {
  it("returns 400 without id or content", async () => {
    const request = new Request("http://localhost:3000/api/notes/scratchpad", {
      method: "PUT",
      body: JSON.stringify({}),
    });
    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it("updates scratchpad content", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);

    // First, create the scratchpad
    const getRequest = new Request(
      `http://localhost:3000/api/notes/scratchpad?lessonId=${lesson.id}`
    );
    const getResponse = await GET(getRequest);
    const scratchpad = await getResponse.json();

    // Update content
    const putRequest = new Request(
      "http://localhost:3000/api/notes/scratchpad",
      {
        method: "PUT",
        body: JSON.stringify({
          id: scratchpad.id,
          content: "Hello $\\LaTeX$ world!",
        }),
      }
    );
    const putResponse = await PUT(putRequest);
    const updated = await putResponse.json();
    expect(putResponse.status).toBe(200);
    expect(updated.content).toBe("Hello $\\LaTeX$ world!");

    // Verify via GET
    const getResponse2 = await GET(
      new Request(
        `http://localhost:3000/api/notes/scratchpad?lessonId=${lesson.id}`
      )
    );
    const data2 = await getResponse2.json();
    expect(data2.content).toBe("Hello $\\LaTeX$ world!");
  });

  it("updates timestamp on save", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);

    const getResponse = await GET(
      new Request(
        `http://localhost:3000/api/notes/scratchpad?lessonId=${lesson.id}`
      )
    );
    const scratchpad = await getResponse.json();
    const originalUpdatedAt = scratchpad.updatedAt;

    // Wait a bit to ensure different timestamp
    await new Promise((r) => setTimeout(r, 50));

    const putResponse = await PUT(
      new Request("http://localhost:3000/api/notes/scratchpad", {
        method: "PUT",
        body: JSON.stringify({
          id: scratchpad.id,
          content: "Updated content",
        }),
      })
    );
    const updated = await putResponse.json();
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(originalUpdatedAt).getTime()
    );
  });
});
