import { prisma } from "@/lib/db";
import { requireOwnerFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/courses/[courseId]/clone — Clone any course into owner's account (owner only)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { userId, error: authError } = await requireOwnerFromRequest(request);
  if (authError) return authError;

  try {
    const { courseId } = await params;

    const source = await prisma.course.findUnique({
      where: { id: courseId },
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
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

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
        },
      });
      lessonIdMap.set(lesson.id, clonedLesson.id);

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

    return NextResponse.json(
      { id: clonedCourse.id, title: clonedCourse.title },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to clone course:", error);
    return NextResponse.json({ error: "Failed to clone course" }, { status: 500 });
  }
}
