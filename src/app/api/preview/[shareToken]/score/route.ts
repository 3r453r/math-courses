import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { scoreQuiz } from "@/lib/quiz/scoring";
import type { QuizQuestion, QuizAnswers } from "@/types/quiz";

/**
 * POST /api/preview/[shareToken]/score — Stateless quiz scoring for preview
 * No auth required. Scores the quiz without saving to DB.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;
    const body = await request.json();
    const { answers } = body as { answers: QuizAnswers };

    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ error: "answers is required" }, { status: 400 });
    }

    // Validate share token and get preview lesson's quiz
    const share = await prisma.courseShare.findUnique({
      where: { shareToken },
      select: {
        isActive: true,
        isGalleryListed: true,
        previewLessonId: true,
        expiresAt: true,
      },
    });

    if (!share || !share.isActive || !share.isGalleryListed || !share.previewLessonId) {
      return NextResponse.json({ error: "Preview not available" }, { status: 404 });
    }

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Share has expired" }, { status: 404 });
    }

    // Get the active quiz for the preview lesson
    const quiz = await prisma.quiz.findFirst({
      where: {
        lessonId: share.previewLessonId,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
      select: { questionsJson: true },
    });

    if (!quiz) {
      return NextResponse.json({ error: "No quiz available" }, { status: 404 });
    }

    const questions: QuizQuestion[] = JSON.parse(quiz.questionsJson);
    const result = scoreQuiz(questions, answers);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to score preview quiz:", error);
    return NextResponse.json({ error: "Failed to score quiz" }, { status: 500 });
  }
}
