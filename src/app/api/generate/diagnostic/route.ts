export const maxDuration = 300;

import { generateObject, NoObjectGeneratedError } from "ai";
import { getApiKeysFromRequest, getModelInstance, getProviderOptions, hasAnyApiKey, MODELS, createRepairFunction } from "@/lib/ai/client";
import { mockDiagnostic } from "@/lib/ai/mockData";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { diagnosticSchema, type DiagnosticOutput } from "@/lib/ai/schemas/diagnosticSchema";
import { buildDiagnosticPrompt } from "@/lib/ai/prompts/quizGeneration";
import { getAuthUser, verifyCourseOwnership } from "@/lib/auth-utils";
import { getCheapestModel, repackWithAI, tryCoerceAndValidate } from "@/lib/ai/repairSchema";

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  let body: { courseId?: string; model?: string } = {};

  try {
    body = await request.json();
    const { courseId } = body;

    if (!courseId) {
      return NextResponse.json({ error: "courseId required" }, { status: 400 });
    }

    // Verify course ownership
    const { error: ownershipError } = await verifyCourseOwnership(courseId, userId);
    if (ownershipError) return ownershipError;

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

    const model = body.model || MODELS.generation;

    let result;
    if (model === "mock") {
      result = mockDiagnostic();
    } else {
      const modelInstance = getModelInstance(model, apiKeys);

      const prompt = buildDiagnosticPrompt({
        courseTitle: course.title,
        courseTopic: course.topic,
        courseDescription: course.description,
        difficulty: course.difficulty,
        lessonTitles: course.lessons.map((l) => l.title),
        language: course.language,
      });

      try {
        const { object } = await generateObject({
          model: modelInstance,
          schema: diagnosticSchema,
          prompt,
          providerOptions: getProviderOptions(model),
          experimental_repairText: createRepairFunction(diagnosticSchema),
        });
        result = object;
      } catch (genErr) {
        if (NoObjectGeneratedError.isInstance(genErr) && genErr.text) {
          console.log(`[diagnostic-gen] Schema mismatch, attempting recovery...`);
          try {
            const parsed = JSON.parse(genErr.text);
            const coerced = tryCoerceAndValidate(parsed, diagnosticSchema);
            if (coerced) {
              console.log(`[diagnostic-gen] Direct coercion succeeded`);
              result = coerced;
            }
          } catch { /* not valid JSON */ }

          if (!result) {
            const cheapModel = getCheapestModel(apiKeys);
            if (cheapModel) {
              console.log(`[diagnostic-gen] Attempting AI repack with ${cheapModel}`);
              const repacked = await repackWithAI(genErr.text, diagnosticSchema, apiKeys, cheapModel);
              if (repacked) {
                console.log(`[diagnostic-gen] AI repack succeeded`);
                result = repacked as DiagnosticOutput;
              }
            }
          }

          if (!result) throw genErr;
        } else {
          throw genErr;
        }
      }
    }

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
