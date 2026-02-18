export const maxDuration = 300;

import { generateObject, NoObjectGeneratedError } from "ai";
import { getApiKeysFromRequest, getModelInstance, getProviderOptions, hasAnyApiKey, MODELS, createRepairFunction, createRepairTracker } from "@/lib/ai/client";
import { mockDiagnostic } from "@/lib/ai/mockData";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { diagnosticSchema, type DiagnosticOutput } from "@/lib/ai/schemas/diagnosticSchema";
import { buildDiagnosticPrompt } from "@/lib/ai/prompts/quizGeneration";
import { getAuthUserFromRequest, verifyCourseOwnership } from "@/lib/auth-utils";
import { getCheapestModel, repackWithAI, tryCoerceAndValidate, unwrapParameter, type WrapperType } from "@/lib/ai/repairSchema";
import { createGenerationLogger } from "@/lib/ai/generationLogger";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const generateDiagnosticBodySchema = z.object({
  courseId: z.string().min(1).max(50),
  model: z.string().max(100).optional(),
});

const GENERATE_DIAGNOSTIC_RATE_LIMIT = {
  namespace: "generate:diagnostic",
  windowMs: 60_000,
  maxRequests: 10,
} as const;

export async function POST(request: Request) {
  const { userId, error } = await getAuthUserFromRequest(request);
  if (error) return error;

  const rateLimitResponse = enforceRateLimit({
    request,
    userId,
    route: "/api/generate/diagnostic",
    config: GENERATE_DIAGNOSTIC_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  let body: z.infer<typeof generateDiagnosticBodySchema> = { courseId: "" };

  try {
    const { data: parsed, error: parseError } = await parseBody(request, generateDiagnosticBodySchema);
    if (parseError) return parseError;
    body = parsed;
    const { courseId } = body;

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

      const logger = createGenerationLogger({
        generationType: "diagnostic",
        schemaName: "diagnosticSchema",
        modelId: model,
        userId,
        courseId,
        language: course.language,
        difficulty: course.difficulty,
        promptText: prompt,
      });

      const tracker = createRepairTracker();

      try {
        const { object } = await generateObject({
          model: modelInstance,
          schema: diagnosticSchema,
          prompt,
          providerOptions: getProviderOptions(model),
          experimental_repairText: createRepairFunction(diagnosticSchema, tracker),
        });
        result = object;
        logger.recordLayer0(tracker);
      } catch (genErr) {
        logger.recordLayer0(tracker);
        if (NoObjectGeneratedError.isInstance(genErr) && genErr.text) {
          console.log(`[diagnostic-gen] Schema mismatch, attempting recovery...`);

          // Layer 1
          let hadWrapper = false;
          let detectedWrapperType: WrapperType = null;
          const zodCollector: { issues: z.ZodIssue[] } = { issues: [] };
          try {
            const parsed = JSON.parse(genErr.text);
            const { unwrapped: target, wasWrapped, wrapperType } = unwrapParameter(parsed);
            hadWrapper = wasWrapped;
            detectedWrapperType = wrapperType;
            const coerced = tryCoerceAndValidate(target, diagnosticSchema, zodCollector);
            if (coerced) {
              console.log(`[diagnostic-gen] Direct coercion succeeded`);
              result = coerced;
            }
          } catch { /* not valid JSON */ }

          logger.recordLayer1({
            rawText: genErr.text,
            hadWrapper,
            wrapperType: detectedWrapperType,
            success: !!result,
            zodErrors: zodCollector.issues,
          });

          // Layer 2
          if (!result) {
            const cheapModel = getCheapestModel(apiKeys);
            if (cheapModel) {
              console.log(`[diagnostic-gen] Attempting AI repack with ${cheapModel}`);
              const repacked = await repackWithAI(genErr.text, diagnosticSchema, apiKeys, cheapModel);
              if (repacked) {
                console.log(`[diagnostic-gen] AI repack succeeded`);
                result = repacked as DiagnosticOutput;
              }
              logger.recordLayer2({ modelId: cheapModel, success: !!repacked });
            }
          }

          if (!result) {
            logger.recordFailure(genErr.message);
            await logger.finalize();
            throw genErr;
          }
        } else {
          const errMsg = genErr instanceof Error ? genErr.message : String(genErr);
          logger.recordFailure(errMsg);
          await logger.finalize();
          throw genErr;
        }
      }

      await logger.finalize();
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
