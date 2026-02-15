import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/users/[userId]/courses — List a user's courses (owner only)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { error: authError } = await requireOwner();
  if (authError) return authError;

  try {
    const { userId } = await params;

    const courses = await prisma.course.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        topic: true,
        subject: true,
        difficulty: true,
        status: true,
        targetLessonCount: true,
        createdAt: true,
        _count: {
          select: { lessons: true },
        },
        lessons: {
          where: { contentJson: { not: null } },
          select: { id: true },
        },
      },
    });

    const result = courses.map((c) => ({
      id: c.id,
      title: c.title,
      topic: c.topic,
      subject: c.subject,
      difficulty: c.difficulty,
      status: c.status,
      lessonCount: c._count.lessons,
      generatedLessonCount: c.lessons.length,
      createdAt: c.createdAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch user courses:", error);
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }
}
