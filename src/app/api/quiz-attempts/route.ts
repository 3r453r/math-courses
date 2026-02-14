import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { scoreQuiz } from "@/lib/quiz/scoring";
import type { QuizQuestion, QuizAnswers } from "@/types/quiz";
import { getAuthUser } from "@/lib/auth-utils";

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { quizId, answers } = body as { quizId?: string; answers?: QuizAnswers };

    if (!quizId || !answers) {
      return NextResponse.json({ error: "quizId and answers required" }, { status: 400 });
    }

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
