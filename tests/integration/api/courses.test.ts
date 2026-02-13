import { describe, it, expect } from "vitest";
import { GET, POST } from "@/app/api/courses/route";
import {
  GET as GET_BY_ID,
  DELETE as DELETE_COURSE,
} from "@/app/api/courses/[courseId]/route";
import {
  createTestCourse,
  createTestLesson,
  createTestEdge,
  createTestQuiz,
  createTestDiagnostic,
  createTestNote,
} from "../helpers/fixtures";
import { getTestPrisma } from "../helpers/db";

describe("GET /api/courses", () => {
  it("returns empty array when no courses exist", async () => {
    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("returns courses with lesson counts", async () => {
    const course = await createTestCourse();
    await createTestLesson(course.id, { title: "Lesson 1", orderIndex: 0 });
    await createTestLesson(course.id, { title: "Lesson 2", orderIndex: 1 });

    const response = await GET();
    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(course.id);
    expect(data[0]._count.lessons).toBe(2);
  });

  it("returns courses ordered by createdAt desc", async () => {
    await createTestCourse({ title: "First Course" });
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 50));
    await createTestCourse({ title: "Second Course" });

    const response = await GET();
    const data = await response.json();
    expect(data).toHaveLength(2);
    expect(data[0].title).toBe("Second Course");
    expect(data[1].title).toBe("First Course");
  });
});

describe("POST /api/courses", () => {
  it("creates a course and returns 201", async () => {
    const body = {
      title: "Linear Algebra",
      description: "Study of vector spaces",
      topic: "Linear Algebra",
      focusAreas: ["Matrices", "Eigenvalues"],
      targetLessonCount: 8,
      difficulty: "intermediate",
    };

    const request = new Request("http://localhost:3000/api/courses", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.title).toBe("Linear Algebra");
    expect(data.topic).toBe("Linear Algebra");
    expect(data.status).toBe("draft");
    expect(JSON.parse(data.focusAreas)).toEqual(["Matrices", "Eigenvalues"]);
  });

  it("uses default values for optional fields", async () => {
    const body = {
      title: "Calculus",
      description: "Intro to calculus",
      topic: "Calculus",
    };

    const request = new Request("http://localhost:3000/api/courses", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.targetLessonCount).toBe(10);
    expect(data.difficulty).toBe("intermediate");
  });
});

describe("GET /api/courses/[courseId]", () => {
  it("returns course with lessons, edges, and diagnostic", async () => {
    const course = await createTestCourse({ status: "ready" });
    const lesson1 = await createTestLesson(course.id, {
      title: "Lesson 1",
      orderIndex: 0,
    });
    const lesson2 = await createTestLesson(course.id, {
      title: "Lesson 2",
      orderIndex: 1,
    });
    await createTestEdge(course.id, lesson1.id, lesson2.id);
    await createTestDiagnostic(course.id, { status: "ready" });

    const response = await GET_BY_ID(
      new Request(`http://localhost:3000/api/courses/${course.id}`),
      { params: Promise.resolve({ courseId: course.id }) }
    );
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.id).toBe(course.id);
    expect(data.lessons).toHaveLength(2);
    expect(data.edges).toHaveLength(1);
    expect(data.diagnosticQuiz).not.toBeNull();
  });

  it("returns 404 for non-existent course", async () => {
    const response = await GET_BY_ID(
      new Request("http://localhost:3000/api/courses/nonexistent"),
      { params: Promise.resolve({ courseId: "nonexistent" }) }
    );
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/courses/[courseId]", () => {
  it("deletes course and returns success", async () => {
    const course = await createTestCourse();

    const response = await DELETE_COURSE(
      new Request(`http://localhost:3000/api/courses/${course.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ courseId: course.id }) }
    );
    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify it's gone
    const prisma = getTestPrisma();
    const found = await prisma.course.findUnique({
      where: { id: course.id },
    });
    expect(found).toBeNull();
  });

  it("cascades delete to all related records", async () => {
    const prisma = getTestPrisma();
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);
    await createTestQuiz(lesson.id, { status: "ready" });
    await createTestNote(lesson.id, { isScratchpad: true });
    await createTestDiagnostic(course.id);

    await DELETE_COURSE(
      new Request(`http://localhost:3000/api/courses/${course.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ courseId: course.id }) }
    );

    expect(await prisma.lesson.count()).toBe(0);
    expect(await prisma.quiz.count()).toBe(0);
    expect(await prisma.note.count()).toBe(0);
    expect(await prisma.diagnosticQuiz.count()).toBe(0);
  });
});
