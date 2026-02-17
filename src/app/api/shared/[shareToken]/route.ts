import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/** Public endpoint — no auth required. Returns read-only course data for a share token. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;

    const share = await prisma.courseShare.findUnique({
      where: { shareToken },
    });

    if (!share || !share.isActive) {
      return NextResponse.json(
        { error: "Share link not found or has been revoked" },
        { status: 404 }
      );
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Share link has expired" },
        { status: 410 }
      );
    }

    const course = await prisma.course.findUnique({
      where: { id: share.courseId },
      include: {
        user: {
          select: { name: true },
        },
        lessons: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            title: true,
            summary: true,
            orderIndex: true,
            status: true,
            contentJson: true,
            isSupplementary: true,
            weight: true,
            completedAt: true,
            quizzes: {
              where: { isActive: true },
              take: 1,
              select: {
                id: true,
                questionsJson: true,
                questionCount: true,
                status: true,
              },
            },
          },
        },
        edges: {
          select: {
            id: true,
            fromLessonId: true,
            toLessonId: true,
            relationship: true,
          },
        },
        completionSummary: {
          select: {
            narrativeMarkdown: true,
            completedAt: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        shareToken,
        course: {
          title: course.title,
          description: course.description,
          topic: course.topic,
          focusAreas: course.focusAreas,
          difficulty: course.difficulty,
          language: course.language,
          contextDoc: course.contextDoc,
          status: course.status,
          authorName: course.user?.name ?? null,
          lessons: course.lessons,
          edges: course.edges,
          completionSummary: course.completionSummary,
        },
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=60, s-maxage=180, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch shared course:", error);
    return NextResponse.json(
      { error: "Failed to fetch shared course" },
      { status: 500 }
    );
  }
}
