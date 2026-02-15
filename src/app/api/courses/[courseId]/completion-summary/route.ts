import { generateObject, NoObjectGeneratedError } from "ai";
import { getApiKeysFromRequest, getModelInstance, getProviderOptions, hasAnyApiKey, MODELS, createRepairFunction } from "@/lib/ai/client";
import { completionSummarySchema, type CompletionSummaryOutput } from "@/lib/ai/schemas/completionSummarySchema";
import { buildCompletionSummaryPrompt } from "@/lib/ai/prompts/completionSummary";
import { mockCompletionSummary } from "@/lib/ai/mockData";
import { evaluateCourseCompletion } from "@/lib/quiz/courseCompletion";
import { prisma } from "@/lib/db";
import { getAuthUser, verifyCourseOwnership } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { getCheapestModel, repackWithAI, tryCoerceAndValidate } from "@/lib/ai/repairSchema";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { userId, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { courseId } = await params;
    const { error: ownerError } = await verifyCourseOwnership(courseId, userId);
    if (ownerError) return ownerError;
    const summary = await prisma.courseCompletionSummary.findUnique({
      where: { courseId },
    });

    if (!summary) {
      return NextResponse.json({ error: "No completion summary found" }, { status: 404 });
    }

    return NextResponse.json({
      summaryData: JSON.parse(summary.summaryJson),
      narrative: summary.narrativeMarkdown,
      recommendation: summary.recommendationJson ? JSON.parse(summary.recommendationJson) : null,
      completedAt: summary.completedAt,
    });
  } catch (error) {
    console.error("Failed to fetch completion summary:", error);
    return NextResponse.json({ error: "Failed to fetch completion summary" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { userId, error: authError } = await getAuthUser();
  if (authError) return authError;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  try {
    const { courseId } = await params;
    const { error: ownerError } = await verifyCourseOwnership(courseId, userId);
    if (ownerError) return ownerError;

    // Gather all completion data
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: {
          orderBy: { orderIndex: "asc" },
          include: {
            quizzes: {
              orderBy: { createdAt: "asc" },
              include: {
                attempts: {
                  orderBy: { createdAt: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Build structured summary data
    const weakTopicMap = new Map<string, { frequency: number; latestScore: number }>();

    const perLesson = course.lessons.map((lesson) => {
      const allAttempts = lesson.quizzes.flatMap((q) =>
        q.attempts.map((a) => ({
          score: a.score,
          weakTopics: JSON.parse(a.weakTopics || "[]") as string[],
        }))
      );

      const weakTopicsAcrossAttempts = [
        ...new Set(allAttempts.flatMap((a) => a.weakTopics)),
      ];

      // Track aggregate weak topics
      for (const attempt of allAttempts) {
        for (const topic of attempt.weakTopics) {
          const existing = weakTopicMap.get(topic);
          weakTopicMap.set(topic, {
            frequency: (existing?.frequency ?? 0) + 1,
            latestScore: attempt.score,
          });
        }
      }

      const scores = allAttempts.map((a) => a.score);
      const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

      return {
        title: lesson.title,
        bestScore,
        weight: lesson.weight,
        quizGenerations: lesson.quizzes.length,
        weakTopicsAcrossAttempts,
      };
    });

    const lessonScoresForCompletion = course.lessons.map((lesson, idx) => ({
      lessonId: lesson.id,
      bestScore: perLesson[idx].bestScore,
      weight: lesson.weight,
    }));
    const completionResult = evaluateCourseCompletion(lessonScoresForCompletion, {
      passThreshold: course.passThreshold,
      noLessonCanFail: course.noLessonCanFail,
      lessonFailureThreshold: course.lessonFailureThreshold,
    });
    const overallAverageScore = completionResult.weightedScore;

    const aggregateWeakTopics = Array.from(weakTopicMap.entries())
      .map(([topic, data]) => ({ topic, ...data }))
      .sort((a, b) => b.frequency - a.frequency);

    const summaryData = {
      totalLessons: course.lessons.length,
      lessonsCompleted: course.lessons.filter((l) => l.completedAt).length,
      overallAverageScore,
      perLesson,
      aggregateWeakTopics,
    };

    const focusAreas = JSON.parse(course.focusAreas || "[]") as string[];

    // AI-generate narrative summary + recommendation
    const body = await request.json().catch(() => ({}));
    const model = body.model || MODELS.generation;

    let object;
    if (model === "mock") {
      object = mockCompletionSummary();
    } else {
      const modelInstance = getModelInstance(model, apiKeys);
      const prompt = buildCompletionSummaryPrompt({
        courseTitle: course.title,
        courseTopic: course.topic,
        difficulty: course.difficulty,
        contextDoc: course.contextDoc,
        focusAreas,
        summaryData,
        passThreshold: course.passThreshold,
        noLessonCanFail: course.noLessonCanFail,
        lessonFailureThreshold: course.lessonFailureThreshold,
        passed: completionResult.passed,
        language: course.language,
      });
      try {
        const result = await generateObject({
          model: modelInstance,
          schema: completionSummarySchema,
          prompt,
          providerOptions: getProviderOptions(model),
          experimental_repairText: createRepairFunction(completionSummarySchema),
        });
        object = result.object;
      } catch (genErr) {
        if (NoObjectGeneratedError.isInstance(genErr) && genErr.text) {
          console.log(`[completion-gen] Schema mismatch, attempting recovery...`);
          try {
            const parsed = JSON.parse(genErr.text);
            const coerced = tryCoerceAndValidate(parsed, completionSummarySchema);
            if (coerced) {
              console.log(`[completion-gen] Direct coercion succeeded`);
              object = coerced;
            }
          } catch { /* not valid JSON */ }

          if (!object) {
            const cheapModel = getCheapestModel(apiKeys);
            if (cheapModel) {
              console.log(`[completion-gen] Attempting AI repack with ${cheapModel}`);
              const repacked = await repackWithAI(genErr.text, completionSummarySchema, apiKeys, cheapModel);
              if (repacked) {
                console.log(`[completion-gen] AI repack succeeded`);
                object = repacked as CompletionSummaryOutput;
              }
            }
          }

          if (!object) throw genErr;
        } else {
          throw genErr;
        }
      }
    }

    // Save to database (upsert to handle regeneration)
    await prisma.courseCompletionSummary.upsert({
      where: { courseId },
      create: {
        courseId,
        summaryJson: JSON.stringify(summaryData),
        narrativeMarkdown: object.narrative,
        recommendationJson: JSON.stringify(object.recommendation),
      },
      update: {
        summaryJson: JSON.stringify(summaryData),
        narrativeMarkdown: object.narrative,
        recommendationJson: JSON.stringify(object.recommendation),
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      summaryData,
      narrative: object.narrative,
      recommendation: object.recommendation,
    });
  } catch (error) {
    console.error("Failed to generate completion summary:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate completion summary" },
      { status: 500 }
    );
  }
}
