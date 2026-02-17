import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { scoreQuiz } from "@/lib/quiz/scoring";
import type { QuizQuestion, QuizAnswers } from "@/types/quiz";
import { getAuthUserFromRequest } from "@/lib/auth-utils";

interface DiagnosticQuestion {
  id: string;
  questionText: string;
  choices: { id: string; text: string; correct: boolean; explanation: string }[];
  prerequisiteTopic: string;
  difficulty: "easy" | "medium" | "hard";
}

export async function POST(request: Request) {
  const { userId, error } = await getAuthUserFromRequest(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { diagnosticQuizId, answers } = body as {
      diagnosticQuizId?: string;
      answers?: QuizAnswers;
    };

    if (!diagnosticQuizId || !answers) {
      return NextResponse.json(
        { error: "diagnosticQuizId and answers required" },
        { status: 400 }
      );
    }

    const diagnosticWithOwner = await prisma.diagnosticQuiz.findUnique({
      where: { id: diagnosticQuizId },
      select: { course: { select: { userId: true } } },
    });
    if (!diagnosticWithOwner || diagnosticWithOwner.course.userId !== userId) {
      return NextResponse.json({ error: "Diagnostic not found" }, { status: 404 });
    }

    const diagnostic = await prisma.diagnosticQuiz.findUnique({
      where: { id: diagnosticQuizId },
    });
    if (!diagnostic) {
      return NextResponse.json({ error: "Diagnostic quiz not found" }, { status: 404 });
    }

    const parsed = JSON.parse(diagnostic.questionsJson) as {
      prerequisites: { topic: string; importance: string; description: string }[];
      questions: DiagnosticQuestion[];
    };

    // Map prerequisiteTopic -> topic for scoreQuiz() compatibility
    const questions: QuizQuestion[] = parsed.questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      choices: q.choices,
      topic: q.prerequisiteTopic,
      difficulty: q.difficulty,
    }));

    const result = scoreQuiz(questions, answers);

    const attempt = await prisma.diagnosticAttempt.create({
      data: {
        diagnosticQuizId,
        answersJson: JSON.stringify(answers),
        score: result.score,
        weakAreas: JSON.stringify(result.weakTopics),
        recommendation: result.recommendation,
      },
    });

    return NextResponse.json({ attempt, result, prerequisites: parsed.prerequisites });
  } catch (error) {
    console.error("Failed to score diagnostic:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to score diagnostic" },
      { status: 500 }
    );
  }
}
