import { prisma } from "@/lib/db";
import { evaluateCourseCompletion } from "@/lib/quiz/courseCompletion";
import { getAuthUser, getAuthUserFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";
import { parseSubjects } from "@/lib/subjects";
import type { NextRequest } from "next/server";

const createCourseSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  topic: z.string().max(500).optional(),
  focusAreas: z.array(z.string().max(200)).max(20).optional(),
  targetLessonCount: z.number().int().min(1).max(50).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  language: z.string().max(10).optional(),
  passThreshold: z.number().min(0).max(1).optional(),
  noLessonCanFail: z.boolean().optional(),
  lessonFailureThreshold: z.number().min(0).max(1).optional(),
});

export async function GET(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const difficulty = searchParams.get("difficulty") ?? undefined;
    const subject = searchParams.get("subject") ?? undefined;
    const sort = searchParams.get("sort") ?? "newest";

    // Build where clause
    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;
    if (difficulty) where.difficulty = difficulty;
    if (subject) where.subject = { contains: `"${subject}"` };
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { topic: { contains: search } },
      ];
    }

    // Sort clause
    let sortClause: Record<string, string>;
    if (sort === "oldest") sortClause = { createdAt: "asc" };
    else if (sort === "updated") sortClause = { updatedAt: "desc" };
    else if (sort === "alpha") sortClause = { title: "asc" };
    else sortClause = { createdAt: "desc" };

    const orderBy = [{ isBookmarked: "desc" }, sortClause];

    const courses = await prisma.course.findMany({
      where,
      orderBy,
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
        subject: course.subject,
        isBookmarked: course.isBookmarked,
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

    // Collect available filter options from all user courses (unfiltered)
    const allCourses = search || status || difficulty || subject
      ? await prisma.course.findMany({
          where: { userId },
          select: { subject: true, language: true },
        })
      : courses.map((c) => ({ subject: c.subject, language: c.language }));

    const subjects = [...new Set(allCourses.flatMap((c) => parseSubjects(c.subject)))].sort();
    const languages = [...new Set(allCourses.map((c) => c.language).filter(Boolean))].sort();

    return NextResponse.json({ courses: coursesWithProgress, filters: { subjects, languages } });
  } catch (error) {
    console.error("Failed to fetch courses:", error);
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }
}

const COURSE_CREATE_RATE_LIMIT = {
  namespace: "courses:create",
  windowMs: 60_000,
  maxRequests: 10,
} as const;

export async function POST(request: Request) {
  const { userId, error: authError } = await getAuthUserFromRequest(request);
  if (authError) return authError;

  const rateLimitResponse = enforceRateLimit({
    request,
    userId,
    route: "/api/courses",
    config: COURSE_CREATE_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { data: body, error: parseError } = await parseBody(request, createCourseSchema);
    if (parseError) return parseError;

    const {
      title, description, topic, focusAreas, targetLessonCount, difficulty, language,
      passThreshold, noLessonCanFail, lessonFailureThreshold,
    } = body;

    const course = await prisma.course.create({
      data: {
        userId,
        title: title ?? "",
        description: description ?? "",
        topic: topic ?? "",
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
