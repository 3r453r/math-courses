import "../helpers/setup";

import { describe, it, expect } from "vitest";
import { GET as exportJson } from "@/app/api/courses/[courseId]/export/json/route";
import { GET as exportMarkdown } from "@/app/api/courses/[courseId]/export/markdown/route";
import { POST as importCourse } from "@/app/api/courses/import/route";
import { POST as createShare, GET as listShares, DELETE as revokeShare } from "@/app/api/courses/[courseId]/share/route";
import { GET as getShared } from "@/app/api/shared/[shareToken]/route";
import { POST as cloneCourse } from "@/app/api/courses/clone/route";
import { createTestCourse, createTestLesson, createTestEdge, createTestQuiz } from "../helpers/fixtures";
import { getTestPrisma } from "../helpers/db";

// ─── JSON Export ────────────────────────────────────────────────────────────────

describe("GET /api/courses/[courseId]/export/json", () => {
  it("returns valid JSON with version field", async () => {
    const course = await createTestCourse({ title: "Export Test Course", status: "ready" });
    const lesson = await createTestLesson(course.id, { title: "Lesson 1", orderIndex: 0 });
    await createTestQuiz(lesson.id, { status: "ready", questionsJson: "[]", questionCount: 0 });

    const request = new Request("http://localhost/api/courses/xxx/export/json");
    const params = Promise.resolve({ courseId: course.id });
    const response = await exportJson(request, { params });

    expect(response.status).toBe(200);
    const text = await response.text();
    const data = JSON.parse(text);
    expect(data.version).toBe(1);
    expect(data.exportedAt).toBeDefined();
    expect(data.course).toBeDefined();
    expect(data.course.title).toBe("Export Test Course");
  });

  it("includes lessons, edges, and notes data", async () => {
    const prisma = getTestPrisma();
    const course = await createTestCourse({ title: "Full Export", status: "ready" });
    const lesson1 = await createTestLesson(course.id, { title: "Lesson A", orderIndex: 0 });
    const lesson2 = await createTestLesson(course.id, { title: "Lesson B", orderIndex: 1 });
    await createTestEdge(course.id, lesson1.id, lesson2.id);
    await createTestQuiz(lesson1.id, { status: "ready", questionsJson: "[{}]", questionCount: 1 });

    // Create a course-level note
    await prisma.note.create({
      data: {
        courseId: course.id,
        title: "Course Note",
        content: "Some course-level note",
        isScratchpad: false,
        orderIndex: 0,
      },
    });

    // Create a lesson-level note (only lessonId, no courseId, so it
    // appears in lesson.notes but not in course-level notes)
    await prisma.note.create({
      data: {
        lessonId: lesson1.id,
        title: "Lesson Note",
        content: "Some lesson note content",
        isScratchpad: false,
        orderIndex: 0,
      },
    });

    const request = new Request("http://localhost/api/courses/xxx/export/json");
    const params = Promise.resolve({ courseId: course.id });
    const response = await exportJson(request, { params });

    expect(response.status).toBe(200);
    const text = await response.text();
    const data = JSON.parse(text);

    expect(data.lessons).toHaveLength(2);
    expect(data.lessons[0].title).toBe("Lesson A");
    expect(data.lessons[1].title).toBe("Lesson B");

    expect(data.edges).toHaveLength(1);
    expect(data.edges[0].fromLessonIndex).toBe(0);
    expect(data.edges[0].toLessonIndex).toBe(1);
    expect(data.edges[0].relationship).toBe("prerequisite");

    expect(data.lessons[0].quizzes).toHaveLength(1);
    expect(data.lessons[0].notes).toHaveLength(1);
    expect(data.lessons[0].notes[0].content).toBe("Some lesson note content");

    expect(data.courseNotes).toHaveLength(1);
    expect(data.courseNotes[0].content).toBe("Some course-level note");
  });

  it("returns 404 for non-existent course", async () => {
    const request = new Request("http://localhost/api/courses/nonexistent/export/json");
    const params = Promise.resolve({ courseId: "nonexistent" });
    const response = await exportJson(request, { params });

    expect(response.status).toBe(404);
  });
});

// ─── Markdown Export ────────────────────────────────────────────────────────────

describe("GET /api/courses/[courseId]/export/markdown", () => {
  it("returns markdown content type", async () => {
    const course = await createTestCourse({ title: "Markdown Course", status: "ready" });
    await createTestLesson(course.id, { title: "Intro Lesson", orderIndex: 0 });

    const request = new Request("http://localhost/api/courses/xxx/export/markdown");
    const params = Promise.resolve({ courseId: course.id });
    const response = await exportMarkdown(request, { params });

    expect(response.status).toBe(200);
    const contentType = response.headers.get("Content-Type");
    expect(contentType).toContain("text/markdown");
  });

  it("contains course title and lesson titles", async () => {
    const course = await createTestCourse({ title: "Calculus 101", status: "ready" });
    await createTestLesson(course.id, { title: "Limits and Continuity", orderIndex: 0 });
    await createTestLesson(course.id, { title: "Derivatives", orderIndex: 1 });

    const request = new Request("http://localhost/api/courses/xxx/export/markdown");
    const params = Promise.resolve({ courseId: course.id });
    const response = await exportMarkdown(request, { params });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("# Calculus 101");
    expect(text).toContain("Limits and Continuity");
    expect(text).toContain("Derivatives");
  });

  it("returns 404 for non-existent course", async () => {
    const request = new Request("http://localhost/api/courses/nonexistent/export/markdown");
    const params = Promise.resolve({ courseId: "nonexistent" });
    const response = await exportMarkdown(request, { params });

    expect(response.status).toBe(404);
  });
});

// ─── JSON Import ────────────────────────────────────────────────────────────────

describe("POST /api/courses/import", () => {
  const validExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    course: {
      title: "Imported Course",
      description: "desc",
      topic: "Math",
      focusAreas: "[]",
      targetLessonCount: 5,
      difficulty: "intermediate",
      language: "en",
      contextDoc: null,
      passThreshold: 0.8,
      noLessonCanFail: true,
      lessonFailureThreshold: 0.5,
      status: "ready",
    },
    lessons: [
      {
        orderIndex: 0,
        title: "Lesson 1",
        summary: "Summary",
        status: "ready",
        contentJson: null,
        rawMarkdown: null,
        isSupplementary: false,
        weight: 1.0,
        completedAt: null,
        quizzes: [],
        notes: [],
        chatMessages: [],
      },
    ],
    edges: [],
    courseNotes: [],
    diagnosticQuiz: null,
    completionSummary: null,
  };

  it("creates a new course from valid JSON", async () => {
    const request = new Request("http://localhost/api/courses/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validExportData),
    });

    const response = await importCourse(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.title).toBe("Imported Course");

    // Verify the course exists in DB
    const prisma = getTestPrisma();
    const course = await prisma.course.findUnique({ where: { id: data.id } });
    expect(course).not.toBeNull();
    expect(course!.title).toBe("Imported Course");
    expect(course!.topic).toBe("Math");
    expect(course!.status).toBe("ready");
  });

  it("returns 400 for invalid format", async () => {
    const request = new Request("http://localhost/api/courses/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foo: "bar" }),
    });

    const response = await importCourse(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 for unsupported version", async () => {
    const request = new Request("http://localhost/api/courses/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validExportData, version: 99 }),
    });

    const response = await importCourse(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Unsupported export version");
  });

  it("creates lessons and edges correctly", async () => {
    const exportWithEdges = {
      ...validExportData,
      lessons: [
        {
          orderIndex: 0,
          title: "Fundamentals",
          summary: "Basic concepts",
          status: "ready",
          contentJson: null,
          rawMarkdown: null,
          isSupplementary: false,
          weight: 1.0,
          completedAt: null,
          quizzes: [],
          notes: [],
          chatMessages: [],
        },
        {
          orderIndex: 1,
          title: "Advanced Topics",
          summary: "Building on fundamentals",
          status: "ready",
          contentJson: null,
          rawMarkdown: null,
          isSupplementary: false,
          weight: 1.0,
          completedAt: null,
          quizzes: [],
          notes: [],
          chatMessages: [],
        },
      ],
      edges: [
        {
          fromLessonIndex: 0,
          toLessonIndex: 1,
          relationship: "prerequisite",
        },
      ],
    };

    const request = new Request("http://localhost/api/courses/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(exportWithEdges),
    });

    const response = await importCourse(request);
    const data = await response.json();
    expect(response.status).toBe(201);

    // Verify lessons
    const prisma = getTestPrisma();
    const lessons = await prisma.lesson.findMany({
      where: { courseId: data.id },
      orderBy: { orderIndex: "asc" },
    });
    expect(lessons).toHaveLength(2);
    expect(lessons[0].title).toBe("Fundamentals");
    expect(lessons[1].title).toBe("Advanced Topics");

    // Verify edges
    const edges = await prisma.courseEdge.findMany({
      where: { courseId: data.id },
    });
    expect(edges).toHaveLength(1);
    expect(edges[0].fromLessonId).toBe(lessons[0].id);
    expect(edges[0].toLessonId).toBe(lessons[1].id);
    expect(edges[0].relationship).toBe("prerequisite");
  });

  it("creates quizzes and notes from import data", async () => {
    const exportWithExtras = {
      ...validExportData,
      lessons: [
        {
          orderIndex: 0,
          title: "Lesson With Quiz",
          summary: "Has a quiz and notes",
          status: "ready",
          contentJson: null,
          rawMarkdown: null,
          isSupplementary: false,
          weight: 1.0,
          completedAt: null,
          quizzes: [
            {
              questionsJson: JSON.stringify([{ question: "What is 2+2?", correctAnswer: "4" }]),
              questionCount: 1,
              status: "ready",
              generation: 1,
              isActive: true,
              attempts: [],
            },
          ],
          notes: [
            {
              title: "My Note",
              content: "Note content here",
              isScratchpad: false,
              orderIndex: 0,
            },
          ],
          chatMessages: [],
        },
      ],
      courseNotes: [
        {
          title: "Course-Level Note",
          content: "Global note",
          isScratchpad: false,
          orderIndex: 0,
        },
      ],
    };

    const request = new Request("http://localhost/api/courses/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(exportWithExtras),
    });

    const response = await importCourse(request);
    const data = await response.json();
    expect(response.status).toBe(201);

    const prisma = getTestPrisma();

    // Verify quiz was created
    const lessons = await prisma.lesson.findMany({ where: { courseId: data.id } });
    const quizzes = await prisma.quiz.findMany({ where: { lessonId: lessons[0].id } });
    expect(quizzes).toHaveLength(1);
    expect(quizzes[0].questionCount).toBe(1);
    expect(quizzes[0].isActive).toBe(true);

    // Verify lesson-level note
    const lessonNotes = await prisma.note.findMany({ where: { lessonId: lessons[0].id } });
    expect(lessonNotes).toHaveLength(1);
    expect(lessonNotes[0].title).toBe("My Note");

    // Verify course-level note
    const courseNotes = await prisma.note.findMany({
      where: { courseId: data.id, lessonId: null },
    });
    expect(courseNotes).toHaveLength(1);
    expect(courseNotes[0].title).toBe("Course-Level Note");
  });
});

// ─── Share Links ────────────────────────────────────────────────────────────────

describe("POST/GET/DELETE /api/courses/[courseId]/share", () => {
  it("creates share link and returns token", async () => {
    const course = await createTestCourse({ title: "Shareable Course", status: "ready" });

    const request = new Request("http://localhost/api/courses/xxx/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const params = Promise.resolve({ courseId: course.id });
    const response = await createShare(request, { params });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.shareToken).toBeDefined();
    expect(typeof data.shareToken).toBe("string");
    expect(data.isActive).toBe(true);
    expect(data.id).toBeDefined();
    expect(data.createdAt).toBeDefined();
  });

  it("creates share link with expiresAt", async () => {
    const course = await createTestCourse({ title: "Expiring Share", status: "ready" });
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const request = new Request("http://localhost/api/courses/xxx/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresAt: futureDate }),
    });
    const params = Promise.resolve({ courseId: course.id });
    const response = await createShare(request, { params });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.expiresAt).not.toBeNull();
  });

  it("lists share links for a course", async () => {
    const course = await createTestCourse({ title: "List Shares", status: "ready" });

    // Create two share links
    const req1 = new Request("http://localhost/api/courses/xxx/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await createShare(req1, { params: Promise.resolve({ courseId: course.id }) });

    const req2 = new Request("http://localhost/api/courses/xxx/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await createShare(req2, { params: Promise.resolve({ courseId: course.id }) });

    // List them
    const listRequest = new Request("http://localhost/api/courses/xxx/share");
    const params = Promise.resolve({ courseId: course.id });
    const response = await listShares(listRequest, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(2);
    expect(data[0].shareToken).toBeDefined();
    expect(data[1].shareToken).toBeDefined();
  });

  it("revokes a share link", async () => {
    const course = await createTestCourse({ title: "Revoke Share", status: "ready" });

    // Create a share link
    const createReq = new Request("http://localhost/api/courses/xxx/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const createResponse = await createShare(createReq, {
      params: Promise.resolve({ courseId: course.id }),
    });
    const shareData = await createResponse.json();

    // Revoke it
    const deleteReq = new Request("http://localhost/api/courses/xxx/share", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId: shareData.id }),
    });
    const deleteResponse = await revokeShare(deleteReq, {
      params: Promise.resolve({ courseId: course.id }),
    });

    expect(deleteResponse.status).toBe(200);
    const deleteData = await deleteResponse.json();
    expect(deleteData.success).toBe(true);

    // Verify it's inactive in the DB
    const prisma = getTestPrisma();
    const share = await prisma.courseShare.findUnique({ where: { id: shareData.id } });
    expect(share!.isActive).toBe(false);
  });

  it("returns 400 when revoking without shareId", async () => {
    const course = await createTestCourse({ title: "No ShareId", status: "ready" });

    const deleteReq = new Request("http://localhost/api/courses/xxx/share", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await revokeShare(deleteReq, {
      params: Promise.resolve({ courseId: course.id }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("shareId required");
  });

  it("returns 404 when revoking a non-existent share link", async () => {
    const course = await createTestCourse({ title: "Bad Revoke", status: "ready" });

    const deleteReq = new Request("http://localhost/api/courses/xxx/share", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId: "nonexistent-share-id" }),
    });
    const response = await revokeShare(deleteReq, {
      params: Promise.resolve({ courseId: course.id }),
    });

    expect(response.status).toBe(404);
  });
});

// ─── Shared Course (public endpoint) ───────────────────────────────────────────

describe("GET /api/shared/[shareToken]", () => {
  it("returns course data for valid token", async () => {
    const course = await createTestCourse({ title: "Shared Course", status: "ready" });
    const lesson = await createTestLesson(course.id, { title: "Shared Lesson", orderIndex: 0 });
    await createTestQuiz(lesson.id, { status: "ready", questionsJson: "[]", questionCount: 0 });

    // Create a share link directly in DB
    const prisma = getTestPrisma();
    const share = await prisma.courseShare.create({
      data: {
        courseId: course.id,
        shareToken: "valid-test-token",
        isActive: true,
      },
    });

    const request = new Request("http://localhost/api/shared/valid-test-token");
    const params = Promise.resolve({ shareToken: share.shareToken });
    const response = await getShared(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.shareToken).toBe("valid-test-token");
    expect(data.course).toBeDefined();
    expect(data.course.title).toBe("Shared Course");
    expect(data.course.lessons).toHaveLength(1);
    expect(data.course.lessons[0].title).toBe("Shared Lesson");
    expect(data.course.edges).toBeDefined();
  });

  it("returns 404 for invalid token", async () => {
    const request = new Request("http://localhost/api/shared/invalid-token");
    const params = Promise.resolve({ shareToken: "invalid-token" });
    const response = await getShared(request, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("returns 404 for revoked token", async () => {
    const course = await createTestCourse({ title: "Revoked Course", status: "ready" });

    const prisma = getTestPrisma();
    await prisma.courseShare.create({
      data: {
        courseId: course.id,
        shareToken: "revoked-token",
        isActive: false,
      },
    });

    const request = new Request("http://localhost/api/shared/revoked-token");
    const params = Promise.resolve({ shareToken: "revoked-token" });
    const response = await getShared(request, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain("revoked");
  });

  it("returns 410 for expired token", async () => {
    const course = await createTestCourse({ title: "Expired Course", status: "ready" });

    const prisma = getTestPrisma();
    await prisma.courseShare.create({
      data: {
        courseId: course.id,
        shareToken: "expired-token",
        isActive: true,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
      },
    });

    const request = new Request("http://localhost/api/shared/expired-token");
    const params = Promise.resolve({ shareToken: "expired-token" });
    const response = await getShared(request, { params });

    expect(response.status).toBe(410);
    const data = await response.json();
    expect(data.error).toContain("expired");
  });
});

// ─── Clone ──────────────────────────────────────────────────────────────────────

describe("POST /api/courses/clone", () => {
  it("creates deep copy under current user", async () => {
    const course = await createTestCourse({ title: "Original Course", status: "ready" });
    const lesson1 = await createTestLesson(course.id, { title: "Lesson 1", orderIndex: 0 });
    const lesson2 = await createTestLesson(course.id, { title: "Lesson 2", orderIndex: 1 });
    await createTestEdge(course.id, lesson1.id, lesson2.id);
    await createTestQuiz(lesson1.id, { status: "ready", questionsJson: "[{}]", questionCount: 1 });

    // Create a share link
    const prisma = getTestPrisma();
    const share = await prisma.courseShare.create({
      data: {
        courseId: course.id,
        shareToken: "clone-token",
        isActive: true,
      },
    });

    const request = new Request("http://localhost/api/courses/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareToken: share.shareToken }),
    });

    const response = await cloneCourse(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.title).toBe("Original Course");

    // Verify the cloned course is a separate entity
    expect(data.id).not.toBe(course.id);

    // Verify lessons were cloned
    const clonedLessons = await prisma.lesson.findMany({
      where: { courseId: data.id },
      orderBy: { orderIndex: "asc" },
    });
    expect(clonedLessons).toHaveLength(2);
    expect(clonedLessons[0].title).toBe("Lesson 1");
    expect(clonedLessons[1].title).toBe("Lesson 2");

    // Verify edges were cloned
    const clonedEdges = await prisma.courseEdge.findMany({
      where: { courseId: data.id },
    });
    expect(clonedEdges).toHaveLength(1);
    expect(clonedEdges[0].fromLessonId).toBe(clonedLessons[0].id);
    expect(clonedEdges[0].toLessonId).toBe(clonedLessons[1].id);

    // Verify quiz was cloned
    const clonedQuizzes = await prisma.quiz.findMany({
      where: { lessonId: clonedLessons[0].id },
    });
    expect(clonedQuizzes).toHaveLength(1);
    expect(clonedQuizzes[0].isActive).toBe(true);
  });

  it("sets clonedFromId on the cloned course", async () => {
    const course = await createTestCourse({ title: "Source Course", status: "ready" });
    await createTestLesson(course.id, { title: "Lesson 1", orderIndex: 0 });

    const prisma = getTestPrisma();
    const share = await prisma.courseShare.create({
      data: {
        courseId: course.id,
        shareToken: "clone-ref-token",
        isActive: true,
      },
    });

    const request = new Request("http://localhost/api/courses/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareToken: share.shareToken }),
    });

    const response = await cloneCourse(request);
    const data = await response.json();
    expect(response.status).toBe(201);

    // Verify clonedFromId
    const clonedCourse = await prisma.course.findUnique({ where: { id: data.id } });
    expect(clonedCourse!.clonedFromId).toBe(course.id);
  });

  it("returns 404 for invalid share token", async () => {
    const request = new Request("http://localhost/api/courses/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareToken: "nonexistent-token" }),
    });

    const response = await cloneCourse(request);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("returns 404 for revoked share token", async () => {
    const course = await createTestCourse({ title: "Revoked Source", status: "ready" });

    const prisma = getTestPrisma();
    await prisma.courseShare.create({
      data: {
        courseId: course.id,
        shareToken: "revoked-clone-token",
        isActive: false,
      },
    });

    const request = new Request("http://localhost/api/courses/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareToken: "revoked-clone-token" }),
    });

    const response = await cloneCourse(request);
    expect(response.status).toBe(404);
  });

  it("returns 400 when shareToken is missing", async () => {
    const request = new Request("http://localhost/api/courses/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await cloneCourse(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("shareToken required");
  });

  it("does not clone completedAt, notes, or chat messages", async () => {
    const prisma = getTestPrisma();
    const course = await createTestCourse({ title: "Full Source", status: "ready" });
    const lesson = await createTestLesson(course.id, { title: "Completed Lesson", orderIndex: 0 });

    // Mark lesson as completed
    await prisma.lesson.update({
      where: { id: lesson.id },
      data: { completedAt: new Date() },
    });

    // Add a note
    await prisma.note.create({
      data: {
        lessonId: lesson.id,
        courseId: course.id,
        content: "Personal note",
        isScratchpad: true,
        orderIndex: 0,
      },
    });

    // Add a chat message
    await prisma.chatMessage.create({
      data: {
        lessonId: lesson.id,
        role: "user",
        content: "Help me understand this",
      },
    });

    const share = await prisma.courseShare.create({
      data: {
        courseId: course.id,
        shareToken: "full-clone-token",
        isActive: true,
      },
    });

    const request = new Request("http://localhost/api/courses/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareToken: share.shareToken }),
    });

    const response = await cloneCourse(request);
    const data = await response.json();
    expect(response.status).toBe(201);

    // Verify completedAt is NOT cloned
    const clonedLessons = await prisma.lesson.findMany({
      where: { courseId: data.id },
    });
    expect(clonedLessons[0].completedAt).toBeNull();

    // Verify notes are NOT cloned
    const clonedNotes = await prisma.note.findMany({
      where: { courseId: data.id },
    });
    expect(clonedNotes).toHaveLength(0);

    // Verify chat messages are NOT cloned
    const clonedMessages = await prisma.chatMessage.findMany({
      where: { lessonId: clonedLessons[0].id },
    });
    expect(clonedMessages).toHaveLength(0);
  });
});

// ─── Round-trip: Export then Import ─────────────────────────────────────────────

describe("Export → Import round-trip", () => {
  it("produces a valid course when exporting then importing", async () => {
    // Create a course with content
    const course = await createTestCourse({ title: "Round-Trip Course", status: "ready" });
    const lesson1 = await createTestLesson(course.id, { title: "RT Lesson 1", orderIndex: 0 });
    const lesson2 = await createTestLesson(course.id, { title: "RT Lesson 2", orderIndex: 1 });
    await createTestEdge(course.id, lesson1.id, lesson2.id);

    // Export
    const exportRequest = new Request("http://localhost/api/courses/xxx/export/json");
    const exportParams = Promise.resolve({ courseId: course.id });
    const exportResponse = await exportJson(exportRequest, { params: exportParams });
    expect(exportResponse.status).toBe(200);
    const exportText = await exportResponse.text();
    const exportData = JSON.parse(exportText);

    // Import
    const importRequest = new Request("http://localhost/api/courses/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(exportData),
    });
    const importResponse = await importCourse(importRequest);
    const importData = await importResponse.json();

    expect(importResponse.status).toBe(201);
    expect(importData.title).toBe("Round-Trip Course");

    // Verify the imported course has the same structure
    const prisma = getTestPrisma();
    const importedLessons = await prisma.lesson.findMany({
      where: { courseId: importData.id },
      orderBy: { orderIndex: "asc" },
    });
    expect(importedLessons).toHaveLength(2);
    expect(importedLessons[0].title).toBe("RT Lesson 1");
    expect(importedLessons[1].title).toBe("RT Lesson 2");

    const importedEdges = await prisma.courseEdge.findMany({
      where: { courseId: importData.id },
    });
    expect(importedEdges).toHaveLength(1);
    expect(importedEdges[0].fromLessonId).toBe(importedLessons[0].id);
    expect(importedEdges[0].toLessonId).toBe(importedLessons[1].id);
  });
});
