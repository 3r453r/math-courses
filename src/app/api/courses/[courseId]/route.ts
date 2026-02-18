import { prisma } from "@/lib/db";
import { getAuthUser, getAuthUserFromRequest, verifyCourseOwnership } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

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
    const body = await request.json();
    const { contextDoc, passThreshold, noLessonCanFail, lessonFailureThreshold, lessonWeights, galleryEligible } = body;

    const updateData: Record<string, unknown> = {};
    if (typeof contextDoc === "string") updateData.contextDoc = contextDoc;
    if (typeof passThreshold === "number") updateData.passThreshold = passThreshold;
    if (typeof noLessonCanFail === "boolean") updateData.noLessonCanFail = noLessonCanFail;
    if (typeof lessonFailureThreshold === "number") updateData.lessonFailureThreshold = lessonFailureThreshold;
    if (typeof galleryEligible === "boolean") updateData.galleryEligible = galleryEligible;

    if (Object.keys(updateData).length > 0) {
      await prisma.course.update({
        where: { id: courseId },
        data: updateData,
      });
    }

    if (lessonWeights && typeof lessonWeights === "object") {
      for (const [lessonId, weight] of Object.entries(lessonWeights)) {
        if (typeof weight === "number" && weight >= 0.1 && weight <= 5.0) {
          await prisma.lesson.update({
            where: { id: lessonId },
            data: { weight },
          });
        }
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
