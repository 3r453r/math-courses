import { generateObject } from "ai";
import { getAnthropicClient, getApiKeyFromRequest, MODELS } from "@/lib/ai/client";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { quizSchema } from "@/lib/ai/schemas/quizSchema";
import { buildQuizPrompt } from "@/lib/ai/prompts/quizGeneration";

export async function POST(request: Request) {
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  let body: { lessonId?: string; courseId?: string; model?: string } = {};

  try {
    body = await request.json();
    const { lessonId, courseId } = body;

    if (!lessonId || !courseId) {
      return NextResponse.json({ error: "lessonId and courseId required" }, { status: 400 });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Idempotent: return existing quiz if ready
    const existingQuiz = await prisma.quiz.findFirst({
      where: { lessonId, status: "ready" },
    });
    if (existingQuiz) {
      return NextResponse.json(existingQuiz);
    }

    // Create quiz record
    const quiz = await prisma.quiz.create({
      data: {
        lessonId,
        questionsJson: "[]",
        status: "generating",
      },
    });

    const anthropic = getAnthropicClient(apiKey);
    const model = body.model || MODELS.generation;

    const prompt = buildQuizPrompt({
      lessonTitle: lesson.title,
      lessonSummary: lesson.summary,
      courseTopic: lesson.course.topic,
      difficulty: lesson.course.difficulty,
    });

    const { object: result } = await generateObject({
      model: anthropic(model),
      schema: quizSchema,
      prompt,
    });

    await prisma.quiz.update({
      where: { id: quiz.id },
      data: {
        questionsJson: JSON.stringify(result.questions),
        questionCount: result.questions.length,
        status: "ready",
      },
    });

    return NextResponse.json({
      ...quiz,
      questionsJson: JSON.stringify(result.questions),
      questionCount: result.questions.length,
      status: "ready",
    });
  } catch (error) {
    console.error("Failed to generate quiz:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate quiz" },
      { status: 500 }
    );
  }
}
