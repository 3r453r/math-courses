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
import { mockCourseSuggestions } from "@/lib/ai/mockData";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { courseSuggestionSchema } from "@/lib/ai/schemas/courseSuggestionSchema";
import { buildCourseSuggestionPrompt } from "@/lib/ai/prompts/courseSuggestion";
import { getAuthUserFromRequest } from "@/lib/auth-utils";
import {
  getCheapestModel,
  tryCoerceAndValidate,
  unwrapParameter,
  type WrapperType,
} from "@/lib/ai/repairSchema";
import { createGenerationLogger } from "@/lib/ai/generationLogger";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const suggestCourseBodySchema = z.object({
  model: z.string().max(100).optional(),
});

const SUGGEST_COURSE_RATE_LIMIT = {
  namespace: "generate:suggest-course",
  windowMs: 60_000,
  maxRequests: 5,
} as const;

export async function POST(request: Request) {
  const { userId, error } = await getAuthUserFromRequest(request);
  if (error) return error;

  const rateLimitResponse = enforceRateLimit({
    request,
    userId,
    route: "/api/generate/suggest-course",
    config: SUGGEST_COURSE_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  try {
    const { data: body, error: parseError } = await parseBody(
      request,
      suggestCourseBodySchema
    );
    if (parseError) return parseError;

    const { model } = body;

    // Fetch user's ready courses
    const courses = await prisma.course.findMany({
      where: { userId, status: "ready" },
      select: {
        title: true,
        topic: true,
        subject: true,
        description: true,
        focusAreas: true,
        difficulty: true,
        language: true,
        lessons: {
          select: { completedAt: true },
        },
      },
    });

    if (courses.length < 2) {
      return NextResponse.json(
        { error: "At least 2 ready courses are required for suggestions" },
        { status: 400 }
      );
    }

    // Determine language: use the most common language among courses
    const langCounts = new Map<string, number>();
    for (const c of courses) {
      langCounts.set(c.language, (langCounts.get(c.language) ?? 0) + 1);
    }
    const language = [...langCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0][0];

    const courseInfos = courses.map((c) => {
      const totalLessons = c.lessons.length;
      const completedLessons = c.lessons.filter(
        (l) => l.completedAt !== null
      ).length;
      const completionPercent =
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0;

      let subjects: string[] = [];
      try {
        subjects = JSON.parse(c.subject);
      } catch {
        subjects = [c.subject];
      }

      let focusAreas: string[] = [];
      try {
        focusAreas = JSON.parse(c.focusAreas);
      } catch {
        focusAreas = [];
      }

      return {
        title: c.title,
        topic: c.topic,
        subjects,
        description: c.description,
        focusAreas,
        difficulty: c.difficulty,
        completionPercent,
      };
    });

    // Pick model: explicit > cheapest available
    const selectedModel =
      model === "mock"
        ? "mock"
        : model || getCheapestModel(apiKeys) || "mock";

    let result;
    if (selectedModel === "mock") {
      result = mockCourseSuggestions();
    } else {
      const modelInstance = getModelInstance(selectedModel, apiKeys);
      const prompt = buildCourseSuggestionPrompt({
        courses: courseInfos,
        language,
      });

      const logger = createGenerationLogger({
        generationType: "suggestion",
        schemaName: "courseSuggestionSchema",
        modelId: selectedModel,
        userId,
        language,
        promptText: prompt,
      });

      const tracker = createRepairTracker();
      const t0 = Date.now();
      console.log(
        `[suggest-course] Starting suggestion generation with model ${selectedModel} (${courses.length} courses)`
      );

      try {
        const { object } = await generateObject({
          model: modelInstance,
          schema: courseSuggestionSchema,
          prompt,
          providerOptions: getProviderOptions(selectedModel),
          experimental_repairText: createRepairFunction(
            courseSuggestionSchema,
            tracker
          ),
        });
        result = object;
        logger.recordLayer0(tracker);
      } catch (genErr) {
        logger.recordLayer0(tracker);
        if (NoObjectGeneratedError.isInstance(genErr) && genErr.text) {
          console.log(
            `[suggest-course] Schema mismatch, attempting recovery...`
          );

          // Layer 1 (no Layer 2 — schema is flat)
          let hadWrapper = false;
          let detectedWrapperType: WrapperType = null;
          const zodCollector: { issues: z.ZodIssue[] } = { issues: [] };
          try {
            const parsed = JSON.parse(genErr.text);
            const {
              unwrapped: target,
              wasWrapped,
              wrapperType,
            } = unwrapParameter(parsed);
            hadWrapper = wasWrapped;
            detectedWrapperType = wrapperType;
            const coerced = tryCoerceAndValidate(
              target,
              courseSuggestionSchema,
              zodCollector
            );
            if (coerced) {
              console.log(`[suggest-course] Direct coercion succeeded`);
              result = coerced;
            }
          } catch {
            /* not valid JSON */
          }

          logger.recordLayer1({
            rawText: genErr.text,
            hadWrapper,
            wrapperType: detectedWrapperType,
            success: !!result,
            zodErrors: zodCollector.issues,
          });

          if (!result) {
            logger.recordFailure(genErr.message);
            await logger.finalize();
            throw genErr;
          }
        } else {
          const errMsg =
            genErr instanceof Error ? genErr.message : String(genErr);
          logger.recordFailure(errMsg);
          await logger.finalize();
          throw genErr;
        }
      }

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `[suggest-course] Suggestion generation completed in ${elapsed}s`
      );

      await logger.finalize();
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to generate course suggestions:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate suggestions",
      },
      { status: 500 }
    );
  }
}
