import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { lessons: true } },
        lessons: {
          select: {
            id: true,
            completedAt: true,
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

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        topic: course.topic,
        difficulty: course.difficulty,
        status: course.status,
        createdAt: course.createdAt,
        _count: course._count,
        progress: {
          completedLessons,
          totalLessons,
          percentComplete: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
          averageScore,
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
  try {
    const body = await request.json();
    const { title, description, topic, focusAreas, targetLessonCount, difficulty, language } = body;

    const course = await prisma.course.create({
      data: {
        title,
        description,
        topic,
        focusAreas: JSON.stringify(focusAreas || []),
        targetLessonCount: targetLessonCount || 10,
        difficulty: difficulty || "intermediate",
        language: language || "en",
        status: "draft",
      },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error("Failed to create course:", error);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}
