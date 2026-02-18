export const maxDuration = 300;

import { generateObject, NoObjectGeneratedError } from "ai";
import {
  getApiKeysFromRequest,
  getModelInstance,
  getProviderOptions,
  hasAnyApiKey,
  createRepairFunction,
  createRepairTracker,
} from "@/lib/ai/client";
import { lessonContentSchema, type LessonContentOutput } from "@/lib/ai/schemas/lessonSchema";
import { quizSchema, type QuizOutput } from "@/lib/ai/schemas/quizSchema";
import { courseTranslationSchema } from "@/lib/ai/schemas/translationSchema";
import {
  buildCourseTranslationPrompt,
  buildLessonTranslationPrompt,
  buildQuizTranslationPrompt,
} from "@/lib/ai/prompts/translation";
import { LANGUAGE_NAMES } from "@/lib/ai/prompts/languageInstruction";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getAuthUserFromRequest, verifyCourseOwnership } from "@/lib/auth-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  getCheapestModel,
  repackWithAI,
  tryCoerceAndValidate,
  unwrapParameter,
  type WrapperType,
} from "@/lib/ai/repairSchema";
import { validateAndRepairVisualizations } from "@/lib/content/vizValidation";
import { createGenerationLogger } from "@/lib/ai/generationLogger";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const regenerateLanguageBodySchema = z.object({
  targetLanguage: z.string().min(2).max(10),
  shareToken: z.string().min(1).max(100).optional(),
});

const REGENERATE_LANGUAGE_RATE_LIMIT = {
  namespace: "courses:regenerate-language",
  windowMs: 60_000,
  maxRequests: 5,
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { userId, error: authError } = await getAuthUserFromRequest(request);
  if (authError) return authError;

  const rateLimitResponse = enforceRateLimit({
    request,
    userId,
    route: "/api/courses/[courseId]/regenerate-language",
    config: REGENERATE_LANGUAGE_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const { courseId } = await params;

  try {
    const { data: body, error: parseError } = await parseBody(
      request,
      regenerateLanguageBodySchema,
    );
    if (parseError) return parseError;

    const { targetLanguage, shareToken } = body;

    // Validate target language
    if (!LANGUAGE_NAMES[targetLanguage]) {
      return NextResponse.json(
        { error: `Unsupported language: ${targetLanguage}` },
        { status: 400 },
      );
    }

    // ── Resolve source course ──────────────────────────────────
    let sourceCourseId: string;

    if (shareToken) {
      // Via share token (gallery / shared link)
      const share = await prisma.courseShare.findUnique({
        where: { shareToken },
      });
      if (!share || !share.isActive) {
        return NextResponse.json(
          { error: "Share link not found or has been revoked" },
          { status: 404 },
        );
      }
      if (share.expiresAt && share.expiresAt < new Date()) {
        return NextResponse.json(
          { error: "Share link has expired" },
          { status: 410 },
        );
      }
      sourceCourseId = share.courseId;
    } else {
      // Owned course — verify ownership
      const { error: ownershipError } = await verifyCourseOwnership(
        courseId,
        userId,
      );
      if (ownershipError) return ownershipError;
      sourceCourseId = courseId;
    }

    // Fetch source course with all data
    const source = await prisma.course.findUnique({
      where: { id: sourceCourseId },
      include: {
        lessons: {
          orderBy: { orderIndex: "asc" },
          include: {
            quizzes: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
        edges: true,
      },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Source course not found" },
        { status: 404 },
      );
    }

    // Select the cheapest available model for translation
    const modelId = getCheapestModel(apiKeys);
    if (!modelId) {
      return NextResponse.json(
        { error: "No AI model available for translation" },
        { status: 400 },
      );
    }

    console.log(
      `[translate] Starting course translation: "${source.title}" → ${targetLanguage} with model ${modelId}`,
    );

    // ── Clone course structure ─────────────────────────────────
    const clonedCourse = await prisma.course.create({
      data: {
        userId,
        title: source.title, // will be overwritten by translation
        description: source.description,
        topic: source.topic,
        subject: source.subject,
        focusAreas: source.focusAreas,
        targetLessonCount: source.targetLessonCount,
        difficulty: source.difficulty,
        language: targetLanguage,
        contextDoc: source.contextDoc,
        passThreshold: source.passThreshold,
        noLessonCanFail: source.noLessonCanFail,
        lessonFailureThreshold: source.lessonFailureThreshold,
        status: "generating",
        clonedFromId: source.id,
      },
    });

    // Clone lessons and track which need translation
    const lessonIdMap = new Map<string, string>();
    const translatableLessons: Array<{
      newLessonId: string;
      sourceContentJson: string;
      sourceTitle: string;
      sourceQuiz: { questionsJson: string; questionCount: number; status: string } | null;
    }> = [];

    for (const lesson of source.lessons) {
      const hasContent = lesson.status === "ready" && lesson.contentJson;

      const clonedLesson = await prisma.lesson.create({
        data: {
          courseId: clonedCourse.id,
          title: lesson.title,
          summary: lesson.summary,
          orderIndex: lesson.orderIndex,
          status: "pending",
          contentJson: null,
          isSupplementary: lesson.isSupplementary,
          weight: lesson.weight,
        },
      });

      lessonIdMap.set(lesson.id, clonedLesson.id);

      if (hasContent) {
        translatableLessons.push({
          newLessonId: clonedLesson.id,
          sourceContentJson: lesson.contentJson!,
          sourceTitle: lesson.title,
          sourceQuiz: lesson.quizzes[0]
            ? {
                questionsJson: lesson.quizzes[0].questionsJson,
                questionCount: lesson.quizzes[0].questionCount,
                status: lesson.quizzes[0].status,
              }
            : null,
        });
      }
    }

    // Clone edges (DAG is language-independent)
    for (const edge of source.edges) {
      const fromId = lessonIdMap.get(edge.fromLessonId);
      const toId = lessonIdMap.get(edge.toLessonId);
      if (fromId && toId) {
        await prisma.courseEdge.create({
          data: {
            courseId: clonedCourse.id,
            fromLessonId: fromId,
            toLessonId: toId,
            relationship: edge.relationship,
          },
        });
      }
    }

    // Increment clone count on share (best-effort)
    if (shareToken) {
      await prisma.courseShare
        .update({
          where: { shareToken },
          data: { cloneCount: { increment: 1 } },
        })
        .catch(() => {});
    }

    // ── Translate course-level fields ──────────────────────────
    const courseLogger = createGenerationLogger({
      generationType: "translate_course",
      schemaName: "courseTranslationSchema",
      modelId,
      userId,
      courseId: clonedCourse.id,
      language: targetLanguage,
      difficulty: source.difficulty,
    });

    try {
      const coursePrompt = buildCourseTranslationPrompt(
        {
          title: source.title,
          description: source.description,
          contextDoc: source.contextDoc,
        },
        targetLanguage,
      );

      const modelInstance = getModelInstance(modelId, apiKeys);
      const tracker = createRepairTracker();

      const { object: translated } = await generateObject({
        model: modelInstance,
        schema: courseTranslationSchema,
        prompt: coursePrompt,
        providerOptions: getProviderOptions(modelId),
        experimental_repairText: createRepairFunction(
          courseTranslationSchema,
          tracker,
        ),
      });

      courseLogger.recordLayer0(tracker);

      await prisma.course.update({
        where: { id: clonedCourse.id },
        data: {
          title: translated.title,
          description: translated.description,
          contextDoc: translated.contextDoc,
        },
      });

      console.log(
        `[translate] Course metadata translated: "${translated.title}"`,
      );
      await courseLogger.finalize();
    } catch (err) {
      console.error("[translate] Course metadata translation failed:", err);
      courseLogger.recordFailure(
        err instanceof Error ? err.message : String(err),
      );
      await courseLogger.finalize();
      // Continue with lessons even if course-level translation fails
    }

    // ── Translate lessons in parallel ──────────────────────────
    const results = await Promise.allSettled(
      translatableLessons.map((item) =>
        translateLesson(item, targetLanguage, modelId, apiKeys, userId, clonedCourse.id),
      ),
    );

    let successCount = 0;
    let failCount = 0;
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log(
      `[translate] Lesson translation complete: ${successCount} succeeded, ${failCount} failed, ${source.lessons.length - translatableLessons.length} skipped (no content)`,
    );

    // Determine final course status
    const allLessonsReady =
      translatableLessons.length > 0 &&
      failCount === 0 &&
      source.lessons.length === translatableLessons.length;

    await prisma.course.update({
      where: { id: clonedCourse.id },
      data: { status: allLessonsReady ? "ready" : "generating" },
    });

    // Re-fetch translated title
    const finalCourse = await prisma.course.findUnique({
      where: { id: clonedCourse.id },
      select: { id: true, title: true },
    });

    return NextResponse.json(
      {
        id: clonedCourse.id,
        title: finalCourse?.title ?? clonedCourse.title,
        lessonsTranslated: successCount,
        lessonsFailed: failCount,
        lessonsSkipped: source.lessons.length - translatableLessons.length,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to translate course:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to translate course",
      },
      { status: 500 },
    );
  }
}

// ── Lesson translation helper ────────────────────────────────

interface TranslatableLesson {
  newLessonId: string;
  sourceContentJson: string;
  sourceTitle: string;
  sourceQuiz: {
    questionsJson: string;
    questionCount: number;
    status: string;
  } | null;
}

async function translateLesson(
  item: TranslatableLesson,
  targetLanguage: string,
  modelId: string,
  apiKeys: Parameters<typeof getModelInstance>[1],
  userId: string,
  courseId: string,
): Promise<boolean> {
  const { newLessonId, sourceContentJson, sourceTitle, sourceQuiz } = item;

  // ── Translate lesson content ───────────────────────────────
  const lessonLogger = createGenerationLogger({
    generationType: "translate_lesson",
    schemaName: "lessonContentSchema",
    modelId,
    userId,
    courseId,
    lessonId: newLessonId,
    language: targetLanguage,
  });

  try {
    await prisma.lesson.update({
      where: { id: newLessonId },
      data: { status: "generating" },
    });

    const modelInstance = getModelInstance(modelId, apiKeys);
    const prompt = buildLessonTranslationPrompt(sourceContentJson, targetLanguage);
    const tracker = createRepairTracker();

    let lessonContent: LessonContentOutput | null = null;

    try {
      const { object } = await generateObject({
        model: modelInstance,
        schema: lessonContentSchema,
        prompt,
        providerOptions: getProviderOptions(modelId),
        experimental_repairText: createRepairFunction(lessonContentSchema, tracker),
      });
      lessonContent = object;
      lessonLogger.recordLayer0(tracker);
    } catch (genErr) {
      lessonLogger.recordLayer0(tracker);

      if (NoObjectGeneratedError.isInstance(genErr) && genErr.text) {
        // Layer 1: direct coercion
        let hadWrapper = false;
        let detectedWrapperType: WrapperType = null;
        const zodCollector: { issues: z.ZodIssue[] } = { issues: [] };

        try {
          const parsed = JSON.parse(genErr.text);
          const { unwrapped, wasWrapped, wrapperType } = unwrapParameter(
            parsed as Record<string, unknown>,
          );
          hadWrapper = wasWrapped;
          detectedWrapperType = wrapperType;
          const coerced = tryCoerceAndValidate(unwrapped, lessonContentSchema, zodCollector);
          if (coerced) lessonContent = coerced;
        } catch {
          // JSON parse failed
        }

        lessonLogger.recordLayer1({
          rawText: genErr.text,
          hadWrapper,
          wrapperType: detectedWrapperType,
          success: !!lessonContent,
          zodErrors: zodCollector.issues,
        });

        // Layer 2: AI repack
        if (!lessonContent) {
          const cheapModel = getCheapestModel(apiKeys);
          if (cheapModel) {
            const repacked = await repackWithAI(
              genErr.text,
              lessonContentSchema,
              apiKeys,
              cheapModel,
            );
            if (repacked) lessonContent = repacked as LessonContentOutput;
            lessonLogger.recordLayer2({
              modelId: cheapModel,
              success: !!repacked,
            });
          }
        }

        if (!lessonContent) {
          lessonLogger.recordFailure(genErr.message);
          await lessonLogger.finalize();
          throw genErr;
        }
      } else {
        const errMsg = genErr instanceof Error ? genErr.message : String(genErr);
        lessonLogger.recordFailure(errMsg);
        await lessonLogger.finalize();
        throw genErr;
      }
    }

    // Normalize visualization specs
    if (lessonContent.sections) {
      for (const section of lessonContent.sections) {
        if (section.type === "visualization" && typeof section.spec === "string") {
          try {
            (section as Record<string, unknown>).spec = JSON.parse(section.spec);
          } catch {
            // Keep as-is
          }
        }
      }
    }

    // Validate visualization expressions
    if (lessonContent.sections) {
      const vizResult = validateAndRepairVisualizations(
        lessonContent.sections as { type: string; vizType?: string; spec?: unknown }[],
      );
      lessonContent.sections = vizResult.sections as typeof lessonContent.sections;
    }

    // Reject empty content
    if (!lessonContent.sections?.length) {
      throw new Error("Translation produced empty lesson content (no sections)");
    }

    await lessonLogger.finalize();

    // Save translated lesson
    await prisma.lesson.update({
      where: { id: newLessonId },
      data: {
        title: lessonContent.title,
        summary: lessonContent.summary,
        contentJson: JSON.stringify(lessonContent),
        status: "ready",
      },
    });

    console.log(`[translate] Lesson translated: "${sourceTitle}" → "${lessonContent.title}"`);

    // ── Translate quiz if present ────────────────────────────
    if (sourceQuiz) {
      await translateQuiz(
        newLessonId,
        sourceQuiz,
        sourceTitle,
        targetLanguage,
        modelId,
        apiKeys,
        userId,
        courseId,
      );
    }

    return true;
  } catch (err) {
    console.error(
      `[translate] Lesson translation failed for "${sourceTitle}":`,
      err instanceof Error ? err.message : err,
    );
    await prisma.lesson
      .update({
        where: { id: newLessonId },
        data: { status: "error" },
      })
      .catch(() => {});
    return false;
  }
}

// ── Quiz translation helper ──────────────────────────────────

async function translateQuiz(
  lessonId: string,
  sourceQuiz: { questionsJson: string; questionCount: number; status: string },
  lessonTitle: string,
  targetLanguage: string,
  modelId: string,
  apiKeys: Parameters<typeof getModelInstance>[1],
  userId: string,
  courseId: string,
): Promise<void> {
  const quizLogger = createGenerationLogger({
    generationType: "translate_quiz",
    schemaName: "quizSchema",
    modelId,
    userId,
    courseId,
    lessonId,
    language: targetLanguage,
  });

  try {
    const modelInstance = getModelInstance(modelId, apiKeys);
    const prompt = buildQuizTranslationPrompt(
      sourceQuiz.questionsJson,
      lessonTitle,
      targetLanguage,
    );
    const tracker = createRepairTracker();

    let quizContent: QuizOutput | null = null;

    try {
      const { object } = await generateObject({
        model: modelInstance,
        schema: quizSchema,
        prompt,
        providerOptions: getProviderOptions(modelId),
        experimental_repairText: createRepairFunction(quizSchema, tracker),
      });
      quizContent = object;
      quizLogger.recordLayer0(tracker);
    } catch (genErr) {
      quizLogger.recordLayer0(tracker);

      if (NoObjectGeneratedError.isInstance(genErr) && genErr.text) {
        let hadWrapper = false;
        let detectedWrapperType: WrapperType = null;
        const zodCollector: { issues: z.ZodIssue[] } = { issues: [] };

        try {
          const parsed = JSON.parse(genErr.text);
          const { unwrapped, wasWrapped, wrapperType } = unwrapParameter(
            parsed as Record<string, unknown>,
          );
          hadWrapper = wasWrapped;
          detectedWrapperType = wrapperType;
          const coerced = tryCoerceAndValidate(unwrapped, quizSchema, zodCollector);
          if (coerced) quizContent = coerced;
        } catch {
          // JSON parse failed
        }

        quizLogger.recordLayer1({
          rawText: genErr.text,
          hadWrapper,
          wrapperType: detectedWrapperType,
          success: !!quizContent,
          zodErrors: zodCollector.issues,
        });

        if (!quizContent) {
          const cheapModel = getCheapestModel(apiKeys);
          if (cheapModel) {
            const repacked = await repackWithAI(genErr.text, quizSchema, apiKeys, cheapModel);
            if (repacked) quizContent = repacked as QuizOutput;
            quizLogger.recordLayer2({ modelId: cheapModel, success: !!repacked });
          }
        }

        if (!quizContent) {
          quizLogger.recordFailure(genErr.message);
          await quizLogger.finalize();
          return;
        }
      } else {
        const errMsg = genErr instanceof Error ? genErr.message : String(genErr);
        quizLogger.recordFailure(errMsg);
        await quizLogger.finalize();
        return;
      }
    }

    await quizLogger.finalize();

    if (quizContent && quizContent.questions.length > 0) {
      await prisma.quiz.create({
        data: {
          lessonId,
          questionsJson: JSON.stringify(quizContent.questions),
          questionCount: quizContent.questions.length,
          status: "ready",
          generation: 1,
          isActive: true,
        },
      });
      console.log(
        `[translate] Quiz translated for "${lessonTitle}": ${quizContent.questions.length} questions`,
      );
    }
  } catch (err) {
    console.error(
      `[translate] Quiz translation failed for "${lessonTitle}":`,
      err instanceof Error ? err.message : err,
    );
    quizLogger.recordFailure(err instanceof Error ? err.message : String(err));
    await quizLogger.finalize();
  }
}
