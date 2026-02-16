export const maxDuration = 300;

import { generateObject, NoObjectGeneratedError } from "ai";
import { getApiKeysFromRequest, getModelInstance, getProviderOptions, hasAnyApiKey, MODELS, createRepairFunction, createRepairTracker } from "@/lib/ai/client";
import { mockQuiz } from "@/lib/ai/mockData";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { quizSchema, type QuizOutput } from "@/lib/ai/schemas/quizSchema";
import { buildQuizPrompt } from "@/lib/ai/prompts/quizGeneration";
import { getAuthUser, verifyCourseOwnership } from "@/lib/auth-utils";
import { getCheapestModel, repackWithAI, tryCoerceAndValidate } from "@/lib/ai/repairSchema";
import { createGenerationLogger } from "@/lib/ai/generationLogger";
import type { z } from "zod";

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  let body: { lessonId?: string; courseId?: string; model?: string; weakTopics?: string[] } = {};
  let createdQuizId: string | null = null;

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

    // Idempotent: return existing active quiz if ready
    const existingQuiz = await prisma.quiz.findFirst({
      where: { lessonId, status: "ready", isActive: true },
    });
    if (existingQuiz) {
      return NextResponse.json(existingQuiz);
    }

    // Guard against double generation
    const generatingQuiz = await prisma.quiz.findFirst({
      where: { lessonId, status: "generating", isActive: true },
    });
    if (generatingQuiz) {
      const ageMs = Date.now() - new Date(generatingQuiz.createdAt).getTime();
      const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
      if (ageMs < STALE_THRESHOLD_MS) {
        return NextResponse.json(
          { error: "Quiz is already being generated" },
          { status: 409 }
        );
      }
      // Stale generating quiz — delete the stuck record
      await prisma.quiz.delete({ where: { id: generatingQuiz.id } });
    }

    // Determine next generation number
    const maxGen = await prisma.quiz.aggregate({
      where: { lessonId },
      _max: { generation: true },
    });
    const nextGeneration = (maxGen._max.generation ?? 0) + 1;

    // Create quiz record
    const quiz = await prisma.quiz.create({
      data: {
        lessonId,
        questionsJson: "[]",
        status: "generating",
        generation: nextGeneration,
        isActive: true,
      },
    });
    createdQuizId = quiz.id;

    const model = body.model || MODELS.generation;

    let result;
    if (model === "mock") {
      result = mockQuiz();
    } else {
      const modelInstance = getModelInstance(model, apiKeys);

      let prompt = buildQuizPrompt({
        lessonTitle: lesson.title,
        lessonSummary: lesson.summary,
        courseTopic: lesson.course.topic,
        difficulty: lesson.course.difficulty,
        lessonContent: lesson.contentJson ? JSON.parse(lesson.contentJson) : undefined,
        language: lesson.course.language,
      });

      if (body.weakTopics && body.weakTopics.length > 0) {
        prompt += `\n\nIMPORTANT - WEAK AREAS:
Include a higher proportion of questions (at least 50%) targeting these weak topics: ${body.weakTopics.join(", ")}`;
      }

      const logger = createGenerationLogger({
        generationType: "quiz",
        schemaName: "quizSchema",
        modelId: model,
        userId,
        courseId,
        lessonId,
        language: lesson.course.language,
        difficulty: lesson.course.difficulty,
        promptText: prompt,
      });

      const tracker = createRepairTracker();
      const t0 = Date.now();
      console.log(`[quiz-gen] Starting quiz generation for "${lesson.title}" with model ${model}`);
      try {
        const { object } = await generateObject({
          model: modelInstance,
          schema: quizSchema,
          prompt,
          providerOptions: getProviderOptions(model),
          experimental_repairText: createRepairFunction(quizSchema, tracker),
        });
        result = object;
        logger.recordLayer0(tracker);
      } catch (genErr) {
        logger.recordLayer0(tracker);
        if (NoObjectGeneratedError.isInstance(genErr) && genErr.text) {
          console.log(`[quiz-gen] Schema mismatch, attempting recovery...`);

          // Layer 1
          let hadWrapper = false;
          const zodCollector: { issues: z.ZodIssue[] } = { issues: [] };
          try {
            const parsed = JSON.parse(genErr.text);
            hadWrapper = "parameter" in parsed;
            const target = hadWrapper && typeof parsed.parameter === "object" ? parsed.parameter : parsed;
            const coerced = tryCoerceAndValidate(target, quizSchema, zodCollector);
            if (coerced) {
              console.log(`[quiz-gen] Direct coercion succeeded`);
              result = coerced;
            }
          } catch { /* not valid JSON */ }

          logger.recordLayer1({
            rawText: genErr.text,
            hadWrapper,
            success: !!result,
            zodErrors: zodCollector.issues,
          });

          // Layer 2
          if (!result) {
            const cheapModel = getCheapestModel(apiKeys);
            if (cheapModel) {
              console.log(`[quiz-gen] Attempting AI repack with ${cheapModel}`);
              const repacked = await repackWithAI(genErr.text, quizSchema, apiKeys, cheapModel);
              if (repacked) {
                console.log(`[quiz-gen] AI repack succeeded`);
                result = repacked as QuizOutput;
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
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[quiz-gen] Quiz generation completed in ${elapsed}s`);

      await logger.finalize();
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
    // Clean up the "generating" quiz record to prevent orphans
    if (createdQuizId) {
      await prisma.quiz.delete({ where: { id: createdQuizId } }).catch(() => {});
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate quiz" },
      { status: 500 }
    );
  }
}
