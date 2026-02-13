import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/quiz-attempts/route";
import { mockQuiz } from "@/lib/ai/mockData";
import {
  createTestCourse,
  createTestLesson,
  createTestQuiz,
} from "../helpers/fixtures";
import { getTestPrisma } from "../helpers/db";

describe("POST /api/quiz-attempts", () => {
  it("returns 400 without quizId or answers", async () => {
    const request = new Request("http://localhost:3000/api/quiz-attempts", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 404 for non-existent quiz", async () => {
    const request = new Request("http://localhost:3000/api/quiz-attempts", {
      method: "POST",
      body: JSON.stringify({
        quizId: "nonexistent",
        answers: { q1: ["a"] },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("scores quiz and creates attempt record", async () => {
    const prisma = getTestPrisma();
    const quizData = mockQuiz();
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);
    const quiz = await createTestQuiz(lesson.id, {
      questionsJson: JSON.stringify(quizData.questions),
      status: "ready",
      questionCount: quizData.questions.length,
    });

    // Answer all questions correctly (correct choice is "a")
    const answers: Record<string, string[]> = {};
    for (const q of quizData.questions) {
      answers[q.id] = ["a"];
    }

    const request = new Request("http://localhost:3000/api/quiz-attempts", {
      method: "POST",
      body: JSON.stringify({ quizId: quiz.id, answers }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.result.score).toBe(1.0);
    expect(data.result.recommendation).toBe("advance");
    expect(data.attempt).toBeDefined();
    expect(data.attempt.quizId).toBe(quiz.id);

    // Verify DB record
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId: quiz.id },
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].score).toBe(1.0);
  });

  it("returns weak topics for partially correct quiz", async () => {
    const quizData = mockQuiz();
    const course = await createTestCourse();
    const lesson = await createTestLesson(course.id);
    const quiz = await createTestQuiz(lesson.id, {
      questionsJson: JSON.stringify(quizData.questions),
      status: "ready",
      questionCount: quizData.questions.length,
    });

    // Answer first 3 correctly, rest wrong
    const answers: Record<string, string[]> = {};
    for (let i = 0; i < quizData.questions.length; i++) {
      answers[quizData.questions[i].id] = i < 3 ? ["a"] : ["b"];
    }

    const request = new Request("http://localhost:3000/api/quiz-attempts", {
      method: "POST",
      body: JSON.stringify({ quizId: quiz.id, answers }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.result.score).toBe(0.3);
    expect(data.result.recommendation).toBe("regenerate");
    expect(data.result.weakTopics.length).toBeGreaterThan(0);
  });
});
