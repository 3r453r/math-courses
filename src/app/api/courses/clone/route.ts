import { prisma } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const cloneCourseSchema = z.object({
  shareToken: z.string().min(1).max(100),
});

/**
 * Clone a shared course to the current user's account.
 * Creates a deep copy: Course + Lessons + Edges + Quizzes.
 * Strips: notes, chat messages, quiz attempts, completion summary.
 */
const COURSE_CLONE_RATE_LIMIT = {
  namespace: "courses:clone",
  windowMs: 60_000,
  maxRequests: 10,
} as const;

export async function POST(request: Request) {
  const { userId, error: authError } = await getAuthUserFromRequest(request);
  if (authError) return authError;

  const rateLimitResponse = enforceRateLimit({
    request,
    userId,
    route: "/api/courses/clone",
    config: COURSE_CLONE_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { data: body, error: parseError } = await parseBody(request, cloneCourseSchema);
    if (parseError) return parseError;
    const { shareToken } = body;
    if (!shareToken) {
      return NextResponse.json({ error: "shareToken required" }, { status: 400 });
    }

    // Validate share token
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

    // Fetch the source course with all data needed for cloning
    const source = await prisma.course.findUnique({
      where: { id: share.courseId },
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
      return NextResponse.json({ error: "Source course not found" }, { status: 404 });
    }

    // Create the cloned course
    const clonedCourse = await prisma.course.create({
      data: {
        userId,
        title: source.title,
        description: source.description,
        topic: source.topic,
        subject: source.subject,
        focusAreas: source.focusAreas,
        targetLessonCount: source.targetLessonCount,
        difficulty: source.difficulty,
        language: source.language,
        contextDoc: source.contextDoc,
        passThreshold: source.passThreshold,
        noLessonCanFail: source.noLessonCanFail,
        lessonFailureThreshold: source.lessonFailureThreshold,
        status: source.status,
        clonedFromId: source.id,
      },
    });

    // Clone lessons and build old-id-to-new-id map
    const lessonIdMap = new Map<string, string>();

    for (const lesson of source.lessons) {
      const clonedLesson = await prisma.lesson.create({
        data: {
          courseId: clonedCourse.id,
          title: lesson.title,
          summary: lesson.summary,
          orderIndex: lesson.orderIndex,
          status: lesson.status,
          contentJson: lesson.contentJson,
          rawMarkdown: lesson.rawMarkdown,
          isSupplementary: lesson.isSupplementary,
          weight: lesson.weight,
          // completedAt is NOT cloned (user starts fresh)
        },
      });
      lessonIdMap.set(lesson.id, clonedLesson.id);

      // Clone active quiz (questions only, no attempts)
      const activeQuiz = lesson.quizzes[0];
      if (activeQuiz) {
        await prisma.quiz.create({
          data: {
            lessonId: clonedLesson.id,
            questionsJson: activeQuiz.questionsJson,
            questionCount: activeQuiz.questionCount,
            status: activeQuiz.status,
            generation: 1,
            isActive: true,
          },
        });
      }
    }

    // Clone edges
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

    // Increment clone count on the source share (best-effort)
    await prisma.courseShare.update({
      where: { shareToken },
      data: { cloneCount: { increment: 1 } },
    }).catch(() => { /* ignore if share was deleted */ });

    return NextResponse.json(
      { id: clonedCourse.id, title: clonedCourse.title },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to clone course:", error);
    return NextResponse.json({ error: "Failed to clone course" }, { status: 500 });
  }
}
