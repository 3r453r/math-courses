import { prisma } from "@/lib/db";
import { getAuthUser, getAuthUserFromRequest, verifyCourseOwnership } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const updateCourseSchema = z.object({
  contextDoc: z.string().max(50000).optional(),
  passThreshold: z.number().min(0).max(1).optional(),
  noLessonCanFail: z.boolean().optional(),
  lessonFailureThreshold: z.number().min(0).max(1).optional(),
  lessonWeights: z.record(z.string(), z.number().min(0.1).max(5.0)).optional(),
  galleryEligible: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { userId, role, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { courseId } = await params;
    const { error: ownerError } = await verifyCourseOwnership(courseId, userId, { allowAdmin: true, role });
    if (ownerError) return ownerError;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: {
          orderBy: { orderIndex: "asc" },
          include: {
            quizzes: {
              where: { isActive: true },
              take: 1,
              orderBy: { createdAt: "desc" },
              include: {
                attempts: {
                  take: 1,
                  orderBy: { createdAt: "desc" },
                },
              },
            },
          },
        },
        edges: true,
        diagnosticQuiz: {
          include: {
            attempts: {
              take: 1,
              orderBy: { createdAt: "desc" },
            },
          },
        },
        completionSummary: true,
        shares: {
          where: { isGalleryListed: true, isActive: true },
          select: {
            id: true,
            shareToken: true,
            creatorClaimed: true,
            creatorClaimedAt: true,
          },
          take: 1,
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(course);
  } catch (error) {
    console.error("Failed to fetch course:", error);
    return NextResponse.json({ error: "Failed to fetch course" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { userId, error: authError } = await getAuthUserFromRequest(request);
  if (authError) return authError;

  try {
    const { courseId } = await params;
    const { error: ownerError } = await verifyCourseOwnership(courseId, userId);
    if (ownerError) return ownerError;
    const { data: body, error: parseError } = await parseBody(request, updateCourseSchema);
    if (parseError) return parseError;

    const { contextDoc, passThreshold, noLessonCanFail, lessonFailureThreshold, lessonWeights, galleryEligible } = body;

    const updateData: Record<string, unknown> = {};
    if (contextDoc !== undefined) updateData.contextDoc = contextDoc;
    if (passThreshold !== undefined) updateData.passThreshold = passThreshold;
    if (noLessonCanFail !== undefined) updateData.noLessonCanFail = noLessonCanFail;
    if (lessonFailureThreshold !== undefined) updateData.lessonFailureThreshold = lessonFailureThreshold;
    if (galleryEligible !== undefined) updateData.galleryEligible = galleryEligible;

    if (Object.keys(updateData).length > 0) {
      await prisma.course.update({
        where: { id: courseId },
        data: updateData,
      });
    }

    if (lessonWeights) {
      for (const [lessonId, weight] of Object.entries(lessonWeights)) {
        await prisma.lesson.update({
          where: { id: lessonId },
          data: { weight },
        });
      }
    }

    const updated = await prisma.course.findUnique({
      where: { id: courseId },
      include: { lessons: { orderBy: { orderIndex: "asc" } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update course:", error);
    return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { userId, error: authError } = await getAuthUserFromRequest(request);
  if (authError) return authError;

  try {
    const { courseId } = await params;
    const { error: ownerError } = await verifyCourseOwnership(courseId, userId);
    if (ownerError) return ownerError;
    await prisma.course.delete({ where: { id: courseId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete course:", error);
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
  }
}
