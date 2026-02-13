import { describe, it, expect } from "vitest";
import { POST as createCourse } from "@/app/api/courses/route";
import { POST as generateCourse } from "@/app/api/generate/course/route";
import { POST as generateLesson } from "@/app/api/generate/lesson/route";
import { POST as generateQuiz } from "@/app/api/generate/quiz/route";
import { POST as submitQuiz } from "@/app/api/quiz-attempts/route";
import { getTestPrisma } from "../helpers/db";

describe("full generation pipeline", () => {
  it("create → generate structure → generate lesson → generate quiz → submit answers", async () => {
    const prisma = getTestPrisma();

    // Step 1: Create course
    const createResponse = await createCourse(
      new Request("http://localhost:3000/api/courses", {
        method: "POST",
        body: JSON.stringify({
          title: "Pipeline Test",
          description: "Full pipeline test",
          topic: "Mathematics",
        }),
      })
    );
    const course = await createResponse.json();
    expect(createResponse.status).toBe(201);
    expect(course.id).toBeTruthy();

    // Step 2: Generate course structure (mock)
    const genCourseResponse = await generateCourse(
      new Request("http://localhost:3000/api/generate/course", {
        method: "POST",
        headers: { "x-api-key": "test-key" },
        body: JSON.stringify({
          courseId: course.id,
          topic: "Mathematics",
          model: "mock",
        }),
      })
    );
    expect(genCourseResponse.status).toBe(200);

    // Verify course is now "ready" with lessons
    const updatedCourse = await prisma.course.findUnique({
      where: { id: course.id },
      include: { lessons: true },
    });
    expect(updatedCourse?.status).toBe("ready");
    expect(updatedCourse!.lessons.length).toBeGreaterThanOrEqual(1);

    const lesson = updatedCourse!.lessons[0];

    // Step 3: Generate lesson content (mock)
    const genLessonResponse = await generateLesson(
      new Request("http://localhost:3000/api/generate/lesson", {
        method: "POST",
        headers: { "x-api-key": "test-key" },
        body: JSON.stringify({
          lessonId: lesson.id,
          courseId: course.id,
          model: "mock",
        }),
      })
    );
    expect(genLessonResponse.status).toBe(200);

    // Verify lesson is now "ready" with content
    const updatedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });
    expect(updatedLesson?.status).toBe("ready");
    expect(updatedLesson?.contentJson).toBeTruthy();

    // Step 4: Generate quiz (mock)
    const genQuizResponse = await generateQuiz(
      new Request("http://localhost:3000/api/generate/quiz", {
        method: "POST",
        headers: { "x-api-key": "test-key" },
        body: JSON.stringify({
          lessonId: lesson.id,
          courseId: course.id,
          model: "mock",
        }),
      })
    );
    const quizData = await genQuizResponse.json();
    expect(genQuizResponse.status).toBe(200);
    expect(quizData.status).toBe("ready");

    // Step 5: Submit quiz answers (all correct)
    const questions = JSON.parse(quizData.questionsJson);
    const answers: Record<string, string[]> = {};
    for (const q of questions) {
      const correctChoice = q.choices.find(
        (c: { correct: boolean }) => c.correct
      );
      answers[q.id] = [correctChoice.id];
    }

    const submitResponse = await submitQuiz(
      new Request("http://localhost:3000/api/quiz-attempts", {
        method: "POST",
        body: JSON.stringify({ quizId: quizData.id, answers }),
      })
    );
    const submitData = await submitResponse.json();
    expect(submitResponse.status).toBe(200);
    expect(submitData.result.score).toBe(1.0);
    expect(submitData.result.recommendation).toBe("advance");

    // Verify all DB records are connected
    const finalCourse = await prisma.course.findUnique({
      where: { id: course.id },
      include: {
        lessons: {
          include: {
            quizzes: {
              include: { attempts: true },
            },
          },
        },
      },
    });
    expect(finalCourse).not.toBeNull();
    expect(finalCourse!.lessons.length).toBeGreaterThanOrEqual(1);
    const finalLesson = finalCourse!.lessons.find(
      (l) => l.id === lesson.id
    )!;
    expect(finalLesson.quizzes).toHaveLength(1);
    expect(finalLesson.quizzes[0].attempts).toHaveLength(1);
    expect(finalLesson.quizzes[0].attempts[0].score).toBe(1.0);
  });
});
