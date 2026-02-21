import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/courses/route";

function makeGetRequest(params?: Record<string, string>) {
  const url = new URL("http://localhost/api/courses");
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}
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
    const response = await GET(makeGetRequest());
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.courses).toEqual([]);
    expect(data.filters).toBeDefined();
  });

  it("returns courses with lesson counts", async () => {
    const course = await createTestCourse();
    await createTestLesson(course.id, { title: "Lesson 1", orderIndex: 0 });
    await createTestLesson(course.id, { title: "Lesson 2", orderIndex: 1 });

    const response = await GET(makeGetRequest());
    const data = await response.json();
    expect(data.courses).toHaveLength(1);
    expect(data.courses[0].id).toBe(course.id);
    expect(data.courses[0]._count.lessons).toBe(2);
  });

  it("returns courses ordered by createdAt desc", async () => {
    await createTestCourse({ title: "First Course" });
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 50));
    await createTestCourse({ title: "Second Course" });

    const response = await GET(makeGetRequest());
    const data = await response.json();
    expect(data.courses).toHaveLength(2);
    expect(data.courses[0].title).toBe("Second Course");
    expect(data.courses[1].title).toBe("First Course");
  });

  it("returns courses with their language field", async () => {
    await createTestCourse({ title: "English Course", language: "en" });
    await createTestCourse({ title: "Polish Course", language: "pl" });

    const response = await GET(makeGetRequest());
    const data = await response.json();
    expect(data.courses).toHaveLength(2);

    const englishCourse = data.courses.find(
      (c: { title: string }) => c.title === "English Course"
    );
    const polishCourse = data.courses.find(
      (c: { title: string }) => c.title === "Polish Course"
    );
    expect(englishCourse.language).toBe("en");
    expect(polishCourse.language).toBe("pl");
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

  it("saves language field when provided", async () => {
    const body = {
      title: "Algebra liniowa",
      description: "Kurs algebry liniowej",
      topic: "Algebra liniowa",
      language: "pl",
    };

    const request = new Request("http://localhost:3000/api/courses", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.language).toBe("pl");
  });

  it("defaults language to 'en' when not provided", async () => {
    const body = {
      title: "Topology",
      description: "Intro to topology",
      topic: "Topology",
    };

    const request = new Request("http://localhost:3000/api/courses", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.language).toBe("en");
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
