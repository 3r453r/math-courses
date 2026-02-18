import { prisma } from "@/lib/db";
import { getAuthUserFromRequest, verifyCourseOwnership } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

/**
 * PATCH /api/courses/[courseId]/gallery-claim — Toggle creator attribution on gallery listing
 * Requires course ownership. Finds the active gallery-listed CourseShare and toggles creatorClaimed.
 */
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

    // Find the active gallery-listed share for this course
    const share = await prisma.courseShare.findFirst({
      where: {
        courseId,
        isGalleryListed: true,
        isActive: true,
      },
    });

    if (!share) {
      return NextResponse.json(
        { error: "No gallery listing found for this course" },
        { status: 404 }
      );
    }

    const newClaimed = !share.creatorClaimed;

    const updated = await prisma.courseShare.update({
      where: { id: share.id },
      data: {
        creatorClaimed: newClaimed,
        creatorClaimedAt: newClaimed ? new Date() : null,
      },
    });

    return NextResponse.json({
      creatorClaimed: updated.creatorClaimed,
      creatorClaimedAt: updated.creatorClaimedAt,
    });
  } catch (error) {
    console.error("Failed to toggle gallery claim:", error);
    return NextResponse.json({ error: "Failed to update attribution" }, { status: 500 });
  }
}
