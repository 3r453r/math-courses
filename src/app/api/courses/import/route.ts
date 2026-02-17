import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { CourseExportJson } from "@/lib/export/toJson";
import { serializeSubjects } from "@/lib/subjects";

const COURSE_IMPORT_RATE_LIMIT = {
  namespace: "courses:import",
  windowMs: 60_000,
  maxRequests: 10,
} as const;

export async function POST(request: Request) {
  const { userId, error: authError } = await getAuthUser();
  if (authError) return authError;

  const rateLimitResponse = enforceRateLimit({
    request,
    userId,
    route: "/api/courses/import",
    config: COURSE_IMPORT_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = (await request.json()) as CourseExportJson;

    if (!body.version || !body.course || !Array.isArray(body.lessons)) {
      return NextResponse.json(
        { error: "Invalid import format" },
        { status: 400 }
      );
    }

    if (body.version > 1) {
      return NextResponse.json(
        { error: "Unsupported export version. Please update the app." },
        { status: 400 }
      );
    }

    const { course: courseData, lessons, edges, courseNotes } = body;

    // Create course
    const course = await prisma.course.create({
      data: {
        userId,
        title: courseData.title,
        description: courseData.description,
        topic: courseData.topic,
        subject: courseData.subject
          ? (courseData.subject.startsWith("[") ? courseData.subject : serializeSubjects([courseData.subject]))
          : serializeSubjects(["Other"]),
        focusAreas: courseData.focusAreas,
        targetLessonCount: courseData.targetLessonCount,
        difficulty: courseData.difficulty,
        language: courseData.language,
        contextDoc: courseData.contextDoc,
        passThreshold: courseData.passThreshold,
        noLessonCanFail: courseData.noLessonCanFail,
        lessonFailureThreshold: courseData.lessonFailureThreshold,
        status: courseData.status,
      },
    });

    // Create lessons and build index-to-id map
    const indexToLessonId = new Map<number, string>();

    for (const lessonData of lessons) {
      const lesson = await prisma.lesson.create({
        data: {
          courseId: course.id,
          orderIndex: lessonData.orderIndex,
          title: lessonData.title,
          summary: lessonData.summary,
          status: lessonData.status,
          contentJson: lessonData.contentJson,
          rawMarkdown: lessonData.rawMarkdown,
          isSupplementary: lessonData.isSupplementary,
          weight: lessonData.weight,
          completedAt: lessonData.completedAt
            ? new Date(lessonData.completedAt)
            : null,
        },
      });
      indexToLessonId.set(lessonData.orderIndex, lesson.id);

      // Create quizzes for this lesson
      for (const quizData of lessonData.quizzes ?? []) {
        const quiz = await prisma.quiz.create({
          data: {
            lessonId: lesson.id,
            questionsJson: quizData.questionsJson,
            questionCount: quizData.questionCount,
            status: quizData.status,
            generation: quizData.generation,
            isActive: quizData.isActive,
          },
        });

        // Create quiz attempts
        for (const attemptData of quizData.attempts ?? []) {
          await prisma.quizAttempt.create({
            data: {
              quizId: quiz.id,
              answersJson: attemptData.answersJson,
              score: attemptData.score,
              weakTopics: attemptData.weakTopics,
              recommendation: attemptData.recommendation,
              createdAt: new Date(attemptData.createdAt),
            },
          });
        }
      }

      // Create lesson notes
      for (const noteData of lessonData.notes ?? []) {
        await prisma.note.create({
          data: {
            lessonId: lesson.id,
            courseId: course.id,
            title: noteData.title,
            content: noteData.content,
            isScratchpad: noteData.isScratchpad,
            orderIndex: noteData.orderIndex,
          },
        });
      }

      // Create chat messages
      for (const msgData of lessonData.chatMessages ?? []) {
        await prisma.chatMessage.create({
          data: {
            lessonId: lesson.id,
            role: msgData.role,
            content: msgData.content,
            createdAt: new Date(msgData.createdAt),
          },
        });
      }
    }

    // Create edges using index-to-id mapping
    for (const edgeData of edges ?? []) {
      const fromId = indexToLessonId.get(edgeData.fromLessonIndex);
      const toId = indexToLessonId.get(edgeData.toLessonIndex);
      if (fromId && toId) {
        await prisma.courseEdge.create({
          data: {
            courseId: course.id,
            fromLessonId: fromId,
            toLessonId: toId,
            relationship: edgeData.relationship,
          },
        });
      }
    }

    // Create course-level notes
    for (const noteData of courseNotes ?? []) {
      await prisma.note.create({
        data: {
          courseId: course.id,
          title: noteData.title,
          content: noteData.content,
          isScratchpad: noteData.isScratchpad,
          orderIndex: noteData.orderIndex,
        },
      });
    }

    return NextResponse.json({ id: course.id, title: course.title }, { status: 201 });
  } catch (error) {
    console.error("Failed to import course:", error);
    return NextResponse.json(
      { error: "Failed to import course" },
      { status: 500 }
    );
  }
}
