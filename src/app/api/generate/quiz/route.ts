import { generateObject } from "ai";
import { getApiKeysFromRequest, getModelInstance, hasAnyApiKey, MODELS } from "@/lib/ai/client";
import { mockQuiz } from "@/lib/ai/mockData";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { quizSchema } from "@/lib/ai/schemas/quizSchema";
import { buildQuizPrompt } from "@/lib/ai/prompts/quizGeneration";
import { getAuthUser, verifyCourseOwnership } from "@/lib/auth-utils";

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  let body: { lessonId?: string; courseId?: string; model?: string } = {};

  try {
    body = await request.json();
    const { lessonId, courseId } = body;

    if (!lessonId || !courseId) {
      return NextResponse.json({ error: "lessonId and courseId required" }, { status: 400 });
    }

    // Verify course ownership
    const { error: ownershipError } = await verifyCourseOwnership(courseId, userId);
    if (ownershipError) return ownershipError;

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

    const model = body.model || MODELS.generation;

    let result;
    if (model === "mock") {
      result = mockQuiz();
    } else {
      const modelInstance = getModelInstance(model, apiKeys);

      const prompt = buildQuizPrompt({
        lessonTitle: lesson.title,
        lessonSummary: lesson.summary,
        courseTopic: lesson.course.topic,
        difficulty: lesson.course.difficulty,
        lessonContent: lesson.contentJson ? JSON.parse(lesson.contentJson) : undefined,
        language: lesson.course.language,
      });

      const { object } = await generateObject({
        model: modelInstance,
        schema: quizSchema,
        prompt,
      });
      result = object;
    }

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
