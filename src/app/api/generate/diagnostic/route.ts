import { generateObject } from "ai";
import { getAnthropicClient, getApiKeyFromRequest, MODELS } from "@/lib/ai/client";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { diagnosticSchema } from "@/lib/ai/schemas/diagnosticSchema";
import { buildDiagnosticPrompt } from "@/lib/ai/prompts/quizGeneration";

export async function POST(request: Request) {
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  let body: { courseId?: string; model?: string } = {};

  try {
    body = await request.json();
    const { courseId } = body;

    if (!courseId) {
      return NextResponse.json({ error: "courseId required" }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { lessons: { orderBy: { orderIndex: "asc" } } },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Idempotent: return existing diagnostic if ready
    const existing = await prisma.diagnosticQuiz.findUnique({
      where: { courseId },
    });
    if (existing && existing.status === "ready") {
      return NextResponse.json(existing);
    }

    // Upsert diagnostic record
    const diagnostic = await prisma.diagnosticQuiz.upsert({
      where: { courseId },
      create: {
        courseId,
        questionsJson: "{}",
        status: "generating",
      },
      update: {
        status: "generating",
      },
    });

    const anthropic = getAnthropicClient(apiKey);
    const model = body.model || MODELS.generation;

    const prompt = buildDiagnosticPrompt({
      courseTitle: course.title,
      courseTopic: course.topic,
      courseDescription: course.description,
      difficulty: course.difficulty,
      lessonTitles: course.lessons.map((l) => l.title),
    });

    const { object: result } = await generateObject({
      model: anthropic(model),
      schema: diagnosticSchema,
      prompt,
    });

    await prisma.diagnosticQuiz.update({
      where: { id: diagnostic.id },
      data: {
        questionsJson: JSON.stringify(result),
        status: "ready",
      },
    });

    return NextResponse.json({
      ...diagnostic,
      questionsJson: JSON.stringify(result),
      status: "ready",
    });
  } catch (error) {
    console.error("Failed to generate diagnostic:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate diagnostic" },
      { status: 500 }
    );
  }
}
