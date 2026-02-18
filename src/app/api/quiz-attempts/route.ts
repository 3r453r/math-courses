import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { scoreQuiz } from "@/lib/quiz/scoring";
import type { QuizQuestion, QuizAnswers } from "@/types/quiz";
import { getAuthUserFromRequest } from "@/lib/auth-utils";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const quizAttemptSchema = z.object({
  quizId: z.string().min(1).max(50),
  answers: z.record(z.string(), z.array(z.string().max(200))),
});

export async function POST(request: Request) {
  const { userId, error } = await getAuthUserFromRequest(request);
  if (error) return error;

  try {
    const { data: body, error: parseError } = await parseBody(request, quizAttemptSchema);
    if (parseError) return parseError;

    const { quizId, answers } = body as { quizId: string; answers: QuizAnswers };

    const quizWithOwner = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { lesson: { select: { course: { select: { userId: true } } } } },
    });
    if (!quizWithOwner || quizWithOwner.lesson.course.userId !== userId) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const questions: QuizQuestion[] = JSON.parse(quiz.questionsJson);
    const result = scoreQuiz(questions, answers);

    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        answersJson: JSON.stringify(answers),
        score: result.score,
        weakTopics: JSON.stringify(result.weakTopics),
        recommendation: result.recommendation,
      },
    });

    // Mark lesson completed on first advance-level score (≥80%)
    if (result.recommendation === "advance") {
      await prisma.lesson.updateMany({
        where: { id: quiz.lessonId, completedAt: null },
        data: { completedAt: new Date() },
      });
    }

    return NextResponse.json({ attempt, result });
  } catch (error) {
    console.error("Failed to score quiz:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to score quiz" },
      { status: 500 }
    );
  }
}
