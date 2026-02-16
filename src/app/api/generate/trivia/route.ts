export const maxDuration = 60;

import { generateObject, NoObjectGeneratedError } from "ai";
import {
  getApiKeysFromRequest,
  getModelInstance,
  getProviderOptions,
  hasAnyApiKey,
  createRepairFunction,
  createRepairTracker,
} from "@/lib/ai/client";
import { mockTrivia } from "@/lib/ai/mockData";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { triviaSchema } from "@/lib/ai/schemas/triviaSchema";
import { buildTriviaPrompt } from "@/lib/ai/prompts/triviaGeneration";
import { getAuthUser, verifyCourseOwnership } from "@/lib/auth-utils";
import { getCheapestModel, tryCoerceAndValidate } from "@/lib/ai/repairSchema";
import { createGenerationLogger } from "@/lib/ai/generationLogger";
import type { z } from "zod";

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { courseId, lessonId, model } = body;

    if (!courseId) {
      return NextResponse.json(
        { error: "courseId required" },
        { status: 400 }
      );
    }

    const { error: ownershipError } = await verifyCourseOwnership(
      courseId,
      userId
    );
    if (ownershipError) return ownershipError;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { topic: true, language: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    let lessonTitle: string | undefined;
    let lessonSummary: string | undefined;

    if (lessonId) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { title: true, summary: true },
      });
      if (lesson) {
        lessonTitle = lesson.title;
        lessonSummary = lesson.summary;
      }
    }

    // Pick model: explicit > cheapest available
    const selectedModel =
      model === "mock"
        ? "mock"
        : model || getCheapestModel(apiKeys) || "mock";

    let result;
    if (selectedModel === "mock") {
      result = mockTrivia();
    } else {
      const modelInstance = getModelInstance(selectedModel, apiKeys);
      const prompt = buildTriviaPrompt({
        courseTopic: course.topic,
        lessonTitle,
        lessonSummary,
        language: course.language,
      });

      const logger = createGenerationLogger({
        generationType: "trivia",
        schemaName: "triviaSchema",
        modelId: selectedModel,
        userId,
        courseId,
        lessonId: lessonId ?? undefined,
        language: course.language,
        promptText: prompt,
      });

      const tracker = createRepairTracker();
      const t0 = Date.now();
      console.log(
        `[trivia-gen] Starting trivia generation for "${course.topic}" with model ${selectedModel}`
      );

      try {
        const { object } = await generateObject({
          model: modelInstance,
          schema: triviaSchema,
          prompt,
          providerOptions: getProviderOptions(selectedModel),
          experimental_repairText: createRepairFunction(triviaSchema, tracker),
        });
        result = object;
        logger.recordLayer0(tracker);
      } catch (genErr) {
        logger.recordLayer0(tracker);
        if (NoObjectGeneratedError.isInstance(genErr) && genErr.text) {
          console.log(
            `[trivia-gen] Schema mismatch, attempting recovery...`
          );

          // Layer 1 (trivia has no Layer 2 / repackWithAI)
          let hadWrapper = false;
          const zodCollector: { issues: z.ZodIssue[] } = { issues: [] };
          try {
            const parsed = JSON.parse(genErr.text);
            hadWrapper = "parameter" in parsed;
            const target = hadWrapper && typeof parsed.parameter === "object" ? parsed.parameter : parsed;
            const coerced = tryCoerceAndValidate(target, triviaSchema, zodCollector);
            if (coerced) {
              console.log(`[trivia-gen] Direct coercion succeeded`);
              result = coerced;
            }
          } catch {
            /* not valid JSON */
          }

          logger.recordLayer1({
            rawText: genErr.text,
            hadWrapper,
            success: !!result,
            zodErrors: zodCollector.issues,
          });

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

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[trivia-gen] Trivia generation completed in ${elapsed}s`);

      await logger.finalize();
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to generate trivia:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate trivia",
      },
      { status: 500 }
    );
  }
}
