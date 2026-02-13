import { describe, it, expect } from "vitest";
import { getTestPrisma } from "../helpers/db";
import {
  createTestCourse,
  createTestLesson,
  createTestEdge,
  createTestQuiz,
  createTestDiagnostic,
  createTestNote,
} from "../helpers/fixtures";

describe("cascading deletes", () => {
  it("deleting a course removes all lessons", async () => {
    const course = await createTestCourse();
    await createTestLesson(course.id, { title: "L1", orderIndex: 0 });
    await createTestLesson(course.id, { title: "L2", orderIndex: 1 });

    await getTestPrisma().course.delete({ where: { id: course.id } });
    expect(await getTestPrisma().lesson.count()).toBe(0);
  });

  it("deleting a course removes all edges", async () => {
    const course = await createTestCourse();
    const l1 = await createTestLesson(course.id, {
      title: "L1",
      orderIndex: 0,
    });
    const l2 = await createTestLesson(course.id, {
      title: "L2",
      orderIndex: 1,
    });
    await createTestEdge(course.id, l1.id, l2.id);

    await getTestPrisma().course.delete({ where: { id: course.id } });
    expect(await getTestPrisma().courseEdge.count()).toBe(0);
  });

  it("deleting a course removes quizzes and attempts", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);
    const quiz = await createTestQuiz(lesson.id, {
      questionsJson: "[]",
      status: "ready",
    });
    await getTestPrisma().quizAttempt.create({
      data: {
        quizId: quiz.id,
        answersJson: "{}",
        score: 0.8,
        weakTopics: "[]",
        recommendation: "advance",
      },
    });

    await getTestPrisma().course.delete({ where: { id: course.id } });
    expect(await getTestPrisma().quiz.count()).toBe(0);
    expect(await getTestPrisma().quizAttempt.count()).toBe(0);
  });

  it("deleting a course removes diagnostic quiz and attempts", async () => {
    const course = await createTestCourse();
    const diagnostic = await createTestDiagnostic(course.id, {
      status: "ready",
    });
    await getTestPrisma().diagnosticAttempt.create({
      data: {
        diagnosticQuizId: diagnostic.id,
        answersJson: "{}",
        score: 0.7,
        weakAreas: "[]",
        recommendation: "supplement",
      },
    });

    await getTestPrisma().course.delete({ where: { id: course.id } });
    expect(await getTestPrisma().diagnosticQuiz.count()).toBe(0);
    expect(await getTestPrisma().diagnosticAttempt.count()).toBe(0);
  });

  it("deleting a course removes notes and chat messages", async () => {
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);
    await createTestNote(lesson.id, {
      content: "test note",
      isScratchpad: true,
    });
    await getTestPrisma().chatMessage.create({
      data: {
        lessonId: lesson.id,
        role: "user",
        content: "Hello",
      },
    });

    await getTestPrisma().course.delete({ where: { id: course.id } });
    expect(await getTestPrisma().note.count()).toBe(0);
    expect(await getTestPrisma().chatMessage.count()).toBe(0);
  });
});

describe("unique constraints", () => {
  it("enforces unique (fromLessonId, toLessonId) on CourseEdge", async () => {
    const course = await createTestCourse();
    const l1 = await createTestLesson(course.id, {
      title: "L1",
      orderIndex: 0,
    });
    const l2 = await createTestLesson(course.id, {
      title: "L2",
      orderIndex: 1,
    });
    await createTestEdge(course.id, l1.id, l2.id);

    // Duplicate should fail
    await expect(
      createTestEdge(course.id, l1.id, l2.id)
    ).rejects.toThrow();
  });

  it("enforces unique courseId on DiagnosticQuiz", async () => {
    const course = await createTestCourse();
    await createTestDiagnostic(course.id);

    // Duplicate should fail
    await expect(createTestDiagnostic(course.id)).rejects.toThrow();
  });
});
