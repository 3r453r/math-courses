import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      where: { status: "ready" },
      orderBy: { createdAt: "desc" },
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
        completionSummary: true,
      },
    });

    let totalLessonsCompleted = 0;
    let totalLessons = 0;
    const allScores: number[] = [];
    const timeline: Array<{
      date: string;
      score: number;
      courseId: string;
      courseTitle: string;
      lessonTitle: string;
      quizGeneration: number;
    }> = [];

    const coursesData = courses.map((course) => {
      const completedLessons = course.lessons.filter((l) => l.completedAt !== null).length;
      const total = course.lessons.length;
      totalLessonsCompleted += completedLessons;
      totalLessons += total;

      const weakTopicMap = new Map<string, { frequency: number; latestScore: number }>();

      const lessons = course.lessons.map((lesson) => {
        const allAttempts = lesson.quizzes.flatMap((q) =>
          q.attempts.map((a) => ({
            score: a.score,
            createdAt: a.createdAt.toISOString(),
            quizGeneration: q.generation,
            weakTopics: JSON.parse(a.weakTopics || "[]") as string[],
            recommendation: a.recommendation,
          }))
        );

        // Track weak topics across all attempts
        for (const attempt of allAttempts) {
          for (const topic of attempt.weakTopics) {
            const existing = weakTopicMap.get(topic);
            weakTopicMap.set(topic, {
              frequency: (existing?.frequency ?? 0) + 1,
              latestScore: attempt.score,
            });
          }

          // Add to timeline
          timeline.push({
            date: attempt.createdAt,
            score: attempt.score,
            courseId: course.id,
            courseTitle: course.title,
            lessonTitle: lesson.title,
            quizGeneration: attempt.quizGeneration,
          });
        }

        const attemptScores = allAttempts.map((a) => a.score);
        allScores.push(...attemptScores);

        // Determine lesson status
        let lessonStatus: "not-started" | "in-progress" | "completed" = "not-started";
        if (lesson.completedAt) {
          lessonStatus = "completed";
        } else if (allAttempts.length > 0) {
          lessonStatus = "in-progress";
        }

        return {
          id: lesson.id,
          title: lesson.title,
          orderIndex: lesson.orderIndex,
          completedAt: lesson.completedAt?.toISOString() ?? null,
          status: lessonStatus,
          attempts: allAttempts,
          regenerationCount: Math.max(0, lesson.quizzes.length - 1),
        };
      });

      const courseScores = lessons.flatMap((l) => l.attempts.map((a) => a.score));
      const avgScore = courseScores.length > 0
        ? courseScores.reduce((a, b) => a + b, 0) / courseScores.length
        : null;
      const bestScore = courseScores.length > 0
        ? Math.max(...courseScores)
        : null;

      const weakTopics = Array.from(weakTopicMap.entries())
        .map(([topic, data]) => ({ topic, ...data }))
        .sort((a, b) => b.frequency - a.frequency);

      const scoreHistory = timeline
        .filter((t) => t.courseId === course.id)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        id: course.id,
        title: course.title,
        topic: course.topic,
        difficulty: course.difficulty,
        progress: {
          completedLessons,
          totalLessons: total,
          percentComplete: total > 0 ? Math.round((completedLessons / total) * 100) : 0,
          averageScore: avgScore,
          bestScore,
          isCompleted: !!course.completionSummary,
        },
        lessons,
        weakTopics,
        scoreHistory,
      };
    });

    const completedCourses = coursesData.filter((c) => c.progress.isCompleted).length;
    const inProgressCourses = coursesData.filter(
      (c) => !c.progress.isCompleted && c.lessons.some((l) => l.attempts.length > 0)
    ).length;
    const overallAvg = allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : null;

    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
      global: {
        totalCourses: coursesData.length,
        completedCourses,
        inProgressCourses,
        overallAverageScore: overallAvg,
        totalLessonsCompleted,
        totalLessons,
      },
      courses: coursesData,
      timeline,
    });
  } catch (error) {
    console.error("Failed to fetch progress:", error);
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}
