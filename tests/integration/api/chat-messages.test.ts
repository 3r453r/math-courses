import { describe, it, expect } from "vitest";
import { GET, POST, DELETE } from "@/app/api/chat/messages/route";
import { createTestCourse, createTestLesson } from "../helpers/fixtures";

describe("GET /api/chat/messages", () => {
  it("returns 400 without lessonId", async () => {
    const request = new Request("http://localhost:3000/api/chat/messages");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns empty array for lesson with no messages", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);

    const request = new Request(
      `http://localhost:3000/api/chat/messages?lessonId=${lesson.id}`
    );
    const response = await GET(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("returns messages ordered by createdAt asc", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);

    // Create messages
    await POST(
      new Request("http://localhost:3000/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          lessonId: lesson.id,
          role: "user",
          content: "First message",
        }),
      })
    );
    await POST(
      new Request("http://localhost:3000/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          lessonId: lesson.id,
          role: "assistant",
          content: "Second message",
        }),
      })
    );

    const response = await GET(
      new Request(
        `http://localhost:3000/api/chat/messages?lessonId=${lesson.id}`
      )
    );
    const data = await response.json();
    expect(data).toHaveLength(2);
    expect(data[0].content).toBe("First message");
    expect(data[0].role).toBe("user");
    expect(data[1].content).toBe("Second message");
    expect(data[1].role).toBe("assistant");
  });
});

describe("POST /api/chat/messages", () => {
  it("returns 400 without required fields", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    expect(response.status).toBe(400);
  });

  it("creates a chat message", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);

    const response = await POST(
      new Request("http://localhost:3000/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          lessonId: lesson.id,
          role: "user",
          content: "What is a derivative?",
        }),
      })
    );
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.lessonId).toBe(lesson.id);
    expect(data.role).toBe("user");
    expect(data.content).toBe("What is a derivative?");
    expect(data.id).toBeTruthy();
  });
});

describe("DELETE /api/chat/messages", () => {
  it("returns 400 without lessonId", async () => {
    const response = await DELETE(
      new Request("http://localhost:3000/api/chat/messages", {
        method: "DELETE",
      })
    );
    expect(response.status).toBe(400);
  });

  it("clears all messages for a lesson", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);

    // Create messages
    await POST(
      new Request("http://localhost:3000/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          lessonId: lesson.id,
          role: "user",
          content: "Hello",
        }),
      })
    );
    await POST(
      new Request("http://localhost:3000/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          lessonId: lesson.id,
          role: "assistant",
          content: "Hi there!",
        }),
      })
    );

    // Delete all
    const deleteResponse = await DELETE(
      new Request(
        `http://localhost:3000/api/chat/messages?lessonId=${lesson.id}`,
        { method: "DELETE" }
      )
    );
    expect(deleteResponse.status).toBe(200);

    // Verify empty
    const getResponse = await GET(
      new Request(
        `http://localhost:3000/api/chat/messages?lessonId=${lesson.id}`
      )
    );
    const data = await getResponse.json();
    expect(data).toEqual([]);
  });

  it("only deletes messages for the specified lesson", async () => {
    const course = await createTestCourse();
    const lesson1 = await createTestLesson(course.id);
    const lesson2 = await createTestLesson(course.id);

    // Create messages for both lessons
    await POST(
      new Request("http://localhost:3000/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          lessonId: lesson1.id,
          role: "user",
          content: "Lesson 1 message",
        }),
      })
    );
    await POST(
      new Request("http://localhost:3000/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          lessonId: lesson2.id,
          role: "user",
          content: "Lesson 2 message",
        }),
      })
    );

    // Delete only lesson1's messages
    await DELETE(
      new Request(
        `http://localhost:3000/api/chat/messages?lessonId=${lesson1.id}`,
        { method: "DELETE" }
      )
    );

    // Lesson 1 should be empty
    const res1 = await GET(
      new Request(
        `http://localhost:3000/api/chat/messages?lessonId=${lesson1.id}`
      )
    );
    expect((await res1.json())).toEqual([]);

    // Lesson 2 should still have its message
    const res2 = await GET(
      new Request(
        `http://localhost:3000/api/chat/messages?lessonId=${lesson2.id}`
      )
    );
    const data2 = await res2.json();
    expect(data2).toHaveLength(1);
    expect(data2[0].content).toBe("Lesson 2 message");
  });
});
