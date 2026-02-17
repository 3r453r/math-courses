import { prisma } from "@/lib/db";
import { evaluateCourseCompletion } from "@/lib/quiz/courseCompletion";
import { getAuthUser, getAuthUserFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  try {
    const courses = await prisma.course.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { lessons: true } },
        lessons: {
          select: {
            id: true,
            completedAt: true,
            weight: true,
            quizzes: {
              where: { isActive: true },
              take: 1,
              select: {
                attempts: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { score: true },
                },
              },
            },
          },
        },
        completionSummary: {
          select: { id: true, completedAt: true },
        },
      },
    });

    const coursesWithProgress = courses.map((course) => {
      const completedLessons = course.lessons.filter((l) => l.completedAt !== null).length;
      const totalLessons = course.lessons.length;
      const scores = course.lessons
        .flatMap((l) => l.quizzes.flatMap((q) => q.attempts.map((a) => a.score)))
        .filter((s): s is number => s !== undefined);
      const averageScore = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null;

      const lessonScores = course.lessons.map((l) => ({
        lessonId: l.id,
        bestScore: l.quizzes[0]?.attempts[0]?.score ?? 0,
        weight: l.weight,
      }));
      const completionResult = evaluateCourseCompletion(lessonScores, {
        passThreshold: course.passThreshold,
        noLessonCanFail: course.noLessonCanFail,
        lessonFailureThreshold: course.lessonFailureThreshold,
      });

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        topic: course.topic,
        difficulty: course.difficulty,
        language: course.language,
        status: course.status,
        createdAt: course.createdAt,
        _count: course._count,
        progress: {
          completedLessons,
          totalLessons,
          percentComplete: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
          averageScore,
          weightedScore: completionResult.weightedScore,
          passed: completionResult.passed,
          isCompleted: !!course.completionSummary,
        },
      };
    });

    return NextResponse.json(coursesWithProgress);
  } catch (error) {
    console.error("Failed to fetch courses:", error);
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId, error: authError } = await getAuthUserFromRequest(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      title, description, topic, focusAreas, targetLessonCount, difficulty, language,
      passThreshold, noLessonCanFail, lessonFailureThreshold,
    } = body;

    const course = await prisma.course.create({
      data: {
        userId,
        title,
        description,
        topic,
        focusAreas: JSON.stringify(focusAreas || []),
        targetLessonCount: targetLessonCount || 10,
        difficulty: difficulty || "intermediate",
        language: language || "en",
        passThreshold: passThreshold ?? 0.8,
        noLessonCanFail: noLessonCanFail ?? true,
        lessonFailureThreshold: lessonFailureThreshold ?? 0.5,
        status: "draft",
      },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error("Failed to create course:", error);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}
