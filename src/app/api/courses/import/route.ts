import { prisma } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { CourseExportJson } from "@/lib/export/toJson";
import { serializeSubjects } from "@/lib/subjects";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

// Deep Zod schema for course import — enforces field types, string lengths, and array caps
const noteSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  content: z.string().max(200000),
  isScratchpad: z.boolean().optional(),
  orderIndex: z.number().int().min(0).default(0),
});

const quizAttemptSchema = z.object({
  answersJson: z.string().max(100000),
  score: z.number().min(0).max(1),
  weakTopics: z.string().max(50000).nullable().optional(),
  recommendation: z.string().max(50).nullable().optional(),
  createdAt: z.string(),
});

const quizSchema = z.object({
  questionsJson: z.string().max(500000),
  questionCount: z.number().int().min(0).max(200),
  status: z.string().max(20),
  generation: z.number().int().min(0).max(100).default(1),
  isActive: z.boolean().default(true),
  attempts: z.array(quizAttemptSchema).max(100).optional(),
});

const chatMessageSchema = z.object({
  role: z.string().max(20),
  content: z.string().max(100000),
  createdAt: z.string(),
});

const lessonSchema = z.object({
  orderIndex: z.number().int().min(0).max(200),
  title: z.string().max(500),
  summary: z.string().max(5000).nullable().optional(),
  status: z.string().max(20),
  contentJson: z.string().max(2_000_000).nullable().optional(),
  rawMarkdown: z.string().max(2_000_000).nullable().optional(),
  isSupplementary: z.boolean().optional(),
  weight: z.number().min(0.1).max(5.0).optional(),
  completedAt: z.string().nullable().optional(),
  quizzes: z.array(quizSchema).max(20).optional(),
  notes: z.array(noteSchema).max(50).optional(),
  chatMessages: z.array(chatMessageSchema).max(500).optional(),
});

const edgeSchema = z.object({
  fromLessonIndex: z.number().int().min(0).max(200),
  toLessonIndex: z.number().int().min(0).max(200),
  relationship: z.string().max(50),
});

const courseImportSchema = z.object({
  version: z.number().int().min(1).max(1),
  course: z.object({
    title: z.string().max(500),
    description: z.string().max(5000).nullable().optional(),
    topic: z.string().max(500),
    subject: z.string().max(500).nullable().optional(),
    focusAreas: z.string().max(5000).nullable().optional(),
    targetLessonCount: z.number().int().min(1).max(50).optional(),
    difficulty: z.string().max(20),
    language: z.string().max(10).optional(),
    contextDoc: z.string().max(100000).nullable().optional(),
    passThreshold: z.number().min(0).max(1).optional(),
    noLessonCanFail: z.boolean().optional(),
    lessonFailureThreshold: z.number().min(0).max(1).optional(),
    status: z.string().max(20),
  }),
  lessons: z.array(lessonSchema).min(1).max(100),
  edges: z.array(edgeSchema).max(500).optional(),
  courseNotes: z.array(noteSchema).max(50).optional(),
});

const COURSE_IMPORT_RATE_LIMIT = {
  namespace: "courses:import",
  windowMs: 60_000,
  maxRequests: 10,
} as const;

export async function POST(request: Request) {
  const { userId, error: authError } = await getAuthUserFromRequest(request);
  if (authError) return authError;

  const rateLimitResponse = enforceRateLimit({
    request,
    userId,
    route: "/api/courses/import",
    config: COURSE_IMPORT_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { data: validated, error: parseError } = await parseBody(request, courseImportSchema);
    if (parseError) return parseError;

    const { course: courseData, lessons, edges, courseNotes } = validated;

    // Create course
    const course = await prisma.course.create({
      data: {
        userId,
        title: courseData.title,
        description: courseData.description ?? "",
        topic: courseData.topic,
        subject: courseData.subject
          ? (courseData.subject.startsWith("[") ? courseData.subject : serializeSubjects([courseData.subject]))
          : serializeSubjects(["Other"]),
        focusAreas: courseData.focusAreas ?? undefined,
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
          summary: lessonData.summary ?? "",
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
              weakTopics: attemptData.weakTopics ?? "",
              recommendation: attemptData.recommendation ?? "",
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
