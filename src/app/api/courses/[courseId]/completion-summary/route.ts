import { generateObject } from "ai";
import { getAnthropicClient, getApiKeyFromRequest, MODELS } from "@/lib/ai/client";
import { completionSummarySchema } from "@/lib/ai/schemas/completionSummarySchema";
import { buildCompletionSummaryPrompt } from "@/lib/ai/prompts/completionSummary";
import { evaluateCourseCompletion } from "@/lib/quiz/courseCompletion";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
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
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  try {
    const { courseId } = await params;

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
    const anthropic = getAnthropicClient(apiKey);
    const model = request.headers.get("x-model") || MODELS.generation;

    const { object } = await generateObject({
      model: anthropic(model),
      schema: completionSummarySchema,
      prompt: buildCompletionSummaryPrompt({
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
      }),
    });

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
