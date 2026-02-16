import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/preview/[shareToken] — Public preview data for gallery courses
 * No auth required. Returns course metadata, all lessons (metadata only),
 * edges, and the full content of the preview lesson + its active quiz.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;

    const share = await prisma.courseShare.findUnique({
      where: { shareToken },
      select: {
        id: true,
        shareToken: true,
        isActive: true,
        expiresAt: true,
        isGalleryListed: true,
        previewLessonId: true,
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            topic: true,
            subject: true,
            focusAreas: true,
            difficulty: true,
            language: true,
            status: true,
            user: { select: { name: true } },
            lessons: {
              where: { isSupplementary: false },
              orderBy: { orderIndex: "asc" },
              select: {
                id: true,
                title: true,
                summary: true,
                orderIndex: true,
                status: true,
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
          },
        },
      },
    });

    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    if (!share.isActive) {
      return NextResponse.json({ error: "Share is inactive" }, { status: 404 });
    }

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Share has expired" }, { status: 404 });
    }

    if (!share.isGalleryListed) {
      return NextResponse.json({ error: "Course is not in the gallery" }, { status: 404 });
    }

    if (!share.previewLessonId) {
      return NextResponse.json({ error: "No preview lesson configured" }, { status: 404 });
    }

    // Fetch the preview lesson's full content and quiz separately
    const previewLesson = await prisma.lesson.findUnique({
      where: { id: share.previewLessonId },
      select: {
        id: true,
        contentJson: true,
        quizzes: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            questionsJson: true,
            questionCount: true,
          },
        },
      },
    });

    // Build the response — lessons only include metadata, no contentJson
    const response = {
      shareToken: share.shareToken,
      previewLessonId: share.previewLessonId,
      course: {
        title: share.course.title,
        description: share.course.description,
        topic: share.course.topic,
        subject: share.course.subject,
        focusAreas: share.course.focusAreas,
        difficulty: share.course.difficulty,
        language: share.course.language,
        status: share.course.status,
        authorName: share.course.user.name,
        lessons: share.course.lessons,
        edges: share.course.edges,
      },
      previewContent: previewLesson
        ? {
            contentJson: previewLesson.contentJson,
            quiz: previewLesson.quizzes[0] ?? null,
          }
        : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch preview data:", error);
    return NextResponse.json({ error: "Failed to fetch preview" }, { status: 500 });
  }
}
