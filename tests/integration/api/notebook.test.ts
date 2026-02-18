import { describe, it, expect } from "vitest";
import { GET, POST } from "@/app/api/courses/[courseId]/notebook/route";
import { PUT, DELETE } from "@/app/api/courses/[courseId]/notebook/[noteId]/route";
import { createTestCourse, createTestLesson, createTestNote } from "../helpers/fixtures";

function makeGetRequest(courseId: string) {
  return new Request(`http://localhost:3000/api/courses/${courseId}/notebook`);
}

function makePostRequest(courseId: string, body: object) {
  return new Request(`http://localhost:3000/api/courses/${courseId}/notebook`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makePutRequest(courseId: string, noteId: string, body: object) {
  return new Request(
    `http://localhost:3000/api/courses/${courseId}/notebook/${noteId}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
}

function makeDeleteRequest(courseId: string, noteId: string) {
  return new Request(
    `http://localhost:3000/api/courses/${courseId}/notebook/${noteId}`,
    { method: "DELETE" }
  );
}

function params(courseId: string, noteId?: string) {
  return noteId
    ? Promise.resolve({ courseId, noteId })
    : Promise.resolve({ courseId });
}

describe("GET /api/courses/[courseId]/notebook", () => {
  it("returns lesson scratchpad pages with content", async () => {
    const course = await createTestCourse();
    const lesson1 = await createTestLesson(course.id, {
      title: "Lesson 1",
      orderIndex: 1,
    });
    const lesson2 = await createTestLesson(course.id, {
      title: "Lesson 2",
      orderIndex: 2,
    });

    // Create scratchpad notes — one with content, one empty
    await createTestNote(lesson1.id, {
      content: "My notes for lesson 1",
      isScratchpad: true,
    });
    await createTestNote(lesson2.id, { content: "", isScratchpad: true });

    const response = await GET(
      makeGetRequest(course.id),
      { params: params(course.id) as Promise<{ courseId: string }> }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pages).toHaveLength(1);
    expect(data.pages[0].type).toBe("lesson");
    expect(data.pages[0].title).toBe("Lesson 1");
    expect(data.pages[0].content).toBe("My notes for lesson 1");
    expect(data.pages[0].lessonId).toBe(lesson1.id);
  });

  it("excludes empty lesson scratchpads", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);
    await createTestNote(lesson.id, { content: "", isScratchpad: true });

    const response = await GET(
      makeGetRequest(course.id),
      { params: params(course.id) as Promise<{ courseId: string }> }
    );
    const data = await response.json();

    expect(data.pages).toHaveLength(0);
  });

  it("returns custom pages interleaved with lesson pages by orderIndex", async () => {
    const course = await createTestCourse();
    const lesson1 = await createTestLesson(course.id, {
      title: "Lesson A",
      orderIndex: 1,
    });
    const lesson2 = await createTestLesson(course.id, {
      title: "Lesson B",
      orderIndex: 3,
    });

    await createTestNote(lesson1.id, {
      content: "Notes A",
      isScratchpad: true,
    });
    await createTestNote(lesson2.id, {
      content: "Notes B",
      isScratchpad: true,
    });

    // Create a custom page between lesson 1 and 2
    const postResponse = await POST(
      makePostRequest(course.id, { title: "Custom Page", orderIndex: 2 }),
      { params: params(course.id) as Promise<{ courseId: string }> }
    );
    expect(postResponse.status).toBe(200);

    const response = await GET(
      makeGetRequest(course.id),
      { params: params(course.id) as Promise<{ courseId: string }> }
    );
    const data = await response.json();

    expect(data.pages).toHaveLength(3);
    expect(data.pages[0].title).toBe("Lesson A");
    expect(data.pages[1].title).toBe("Custom Page");
    expect(data.pages[1].type).toBe("custom");
    expect(data.pages[2].title).toBe("Lesson B");
  });
});

describe("POST /api/courses/[courseId]/notebook", () => {
  it("creates custom page with correct orderIndex", async () => {
    const course = await createTestCourse();

    const response = await POST(
      makePostRequest(course.id, { title: "My Notes", orderIndex: 5 }),
      { params: params(course.id) as Promise<{ courseId: string }> }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.type).toBe("custom");
    expect(data.title).toBe("My Notes");
    expect(data.content).toBe("");
    expect(data.orderIndex).toBe(5);
    expect(data.lessonId).toBeNull();
  });

  it("returns 404 for non-existent course", async () => {
    const response = await POST(
      makePostRequest("nonexistent", { title: "Test" }),
      { params: params("nonexistent") as Promise<{ courseId: string }> }
    );
    expect(response.status).toBe(404);
  });
});

describe("PUT /api/courses/[courseId]/notebook/[noteId]", () => {
  it("updates custom page title and content", async () => {
    const course = await createTestCourse();

    // Create a custom page
    const createRes = await POST(
      makePostRequest(course.id, { title: "Draft", orderIndex: 1 }),
      { params: params(course.id) as Promise<{ courseId: string }> }
    );
    const created = await createRes.json();

    const response = await PUT(
      makePutRequest(course.id, created.id, {
        title: "Updated Title",
        content: "Some content",
      }),
      { params: params(course.id, created.id) as Promise<{ courseId: string; noteId: string }> }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.title).toBe("Updated Title");
    expect(data.content).toBe("Some content");
  });

  it("returns 400 without title or content", async () => {
    const course = await createTestCourse();
    const createRes = await POST(
      makePostRequest(course.id, { title: "Test" }),
      { params: params(course.id) as Promise<{ courseId: string }> }
    );
    const created = await createRes.json();

    const response = await PUT(
      makePutRequest(course.id, created.id, {}),
      { params: params(course.id, created.id) as Promise<{ courseId: string; noteId: string }> }
    );
    expect(response.status).toBe(400);
  });

  it("returns 404 for non-existent note", async () => {
    const response = await PUT(
      makePutRequest("course1", "nonexistent", { title: "Test" }),
      { params: params("course1", "nonexistent") as Promise<{ courseId: string; noteId: string }> }
    );
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/courses/[courseId]/notebook/[noteId]", () => {
  it("removes custom page", async () => {
    const course = await createTestCourse();

    const createRes = await POST(
      makePostRequest(course.id, { title: "To Delete", orderIndex: 1 }),
      { params: params(course.id) as Promise<{ courseId: string }> }
    );
    const created = await createRes.json();

    const response = await DELETE(
      makeDeleteRequest(course.id, created.id),
      { params: params(course.id, created.id) as Promise<{ courseId: string; noteId: string }> }
    );
    expect(response.status).toBe(200);

    // Verify it's gone
    const getRes = await GET(
      makeGetRequest(course.id),
      { params: params(course.id) as Promise<{ courseId: string }> }
    );
    const data = await getRes.json();
    expect(data.pages).toHaveLength(0);
  });

  it("rejects deleting lesson scratchpad pages", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);
    const note = await createTestNote(lesson.id, {
      content: "Some notes",
      isScratchpad: true,
    });

    const response = await DELETE(
      makeDeleteRequest(course.id, note.id),
      { params: params(course.id, note.id) as Promise<{ courseId: string; noteId: string }> }
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Cannot delete lesson scratchpad");
  });

  it("returns 404 for non-existent note", async () => {
    const response = await DELETE(
      makeDeleteRequest("course1", "nonexistent"),
      { params: params("course1", "nonexistent") as Promise<{ courseId: string; noteId: string }> }
    );
    expect(response.status).toBe(404);
  });
});
