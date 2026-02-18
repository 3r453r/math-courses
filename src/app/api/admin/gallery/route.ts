import { prisma } from "@/lib/db";
import { requireAdmin, requireAdminFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * Walk the clone lineage chain upward (ancestors) and downward (descendants)
 * to find any gallery-listed CourseShare that conflicts.
 */
async function findCloneConflict(courseId: string) {
  const relatedCourseIds: string[] = [];

  // Walk ancestors (clonedFromId chain, max 10 hops)
  let currentId: string | null = courseId;
  for (let i = 0; i < 10 && currentId; i++) {
    const ancestor: { clonedFromId: string | null } | null = await prisma.course.findUnique({
      where: { id: currentId },
      select: { clonedFromId: true },
    });
    if (!ancestor?.clonedFromId) break;
    relatedCourseIds.push(ancestor.clonedFromId);
    currentId = ancestor.clonedFromId;
  }

  // Direct descendants (courses cloned from this one)
  const descendants = await prisma.course.findMany({
    where: { clonedFromId: courseId },
    select: { id: true },
  });
  relatedCourseIds.push(...descendants.map((d) => d.id));

  if (relatedCourseIds.length === 0) return null;

  // Check if any related course has a gallery-listed share
  const conflicting = await prisma.courseShare.findFirst({
    where: {
      courseId: { in: relatedCourseIds },
      isGalleryListed: true,
      isActive: true,
    },
    include: {
      course: {
        select: { title: true, topic: true, subject: true },
      },
    },
  });

  return conflicting;
}

/**
 * GET /api/admin/gallery — List ALL courses from all users (admin only)
 * Shows courses with their active shares (if any) and eligibility info.
 * This allows admins to promote any course to the gallery, even if the
 * owner hasn't created a share link yet.
 */
export async function GET() {
  const { role, error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const courses = await prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        lessons: {
          where: { isSupplementary: false },
          orderBy: { orderIndex: "asc" },
          select: { id: true, title: true, status: true, contentJson: true, orderIndex: true },
        },
        shares: {
          where: { isActive: true },
          select: {
            id: true,
            shareToken: true,
            isGalleryListed: true,
            galleryTitle: true,
            galleryDescription: true,
            tags: true,
            starCount: true,
            cloneCount: true,
            featuredAt: true,
            expiresAt: true,
            previewLessonId: true,
          },
        },
      },
    });

    const result = courses.map((course) => {
      const totalLessons = course.lessons.length;
      const generatedLessons = course.lessons.filter(
        (l) => l.status !== "pending" && l.contentJson !== null
      ).length;
      const isEligible = totalLessons > 0 && generatedLessons === totalLessons;

      const { lessons, ...courseWithoutLessons } = course;

      return {
        ...courseWithoutLessons,
        lessonList: lessons.map((l) => ({
          id: l.id,
          title: l.title,
          orderIndex: l.orderIndex,
        })),
        eligibility: {
          isEligible,
          totalLessons,
          generatedLessons,
        },
      };
    });

    return NextResponse.json({ courses: result, role });
  } catch (error) {
    console.error("Failed to list courses for gallery:", error);
    return NextResponse.json({ error: "Failed to list courses" }, { status: 500 });
  }
}

/**
 * POST /api/admin/gallery — Auto-create a share and add to gallery (admin only)
 * For courses that don't have an existing share link. Creates a CourseShare
 * with isGalleryListed: true and no expiry.
 */
export async function POST(request: Request) {
  const { role, error: authError } = await requireAdminFromRequest(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { courseId, cloneConflictAction } = body;

    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 });
    }

    // Validate the course exists and is eligible
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        status: true,
        clonedFromId: true,
        lessons: {
          where: { isSupplementary: false },
          select: { status: true, contentJson: true },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const allGenerated = course.lessons.length > 0 &&
      course.lessons.every((l) => l.status !== "pending" && l.contentJson !== null);

    if (!allGenerated && role !== "owner") {
      return NextResponse.json(
        { error: "Course must be fully generated before adding to gallery" },
        { status: 400 }
      );
    }

    // Clone conflict detection
    const conflict = await findCloneConflict(course.id);
    if (conflict) {
      if (!cloneConflictAction) {
        return NextResponse.json({
          cloneConflict: true,
          conflictingShare: {
            id: conflict.id,
            shareToken: conflict.shareToken,
            course: conflict.course,
          },
        });
      }

      if (cloneConflictAction === "replace") {
        await prisma.courseShare.update({
          where: { id: conflict.id },
          data: { isGalleryListed: false },
        });
      }
      // "add": proceed normally
    }

    // Create a new share with gallery listing
    const share = await prisma.courseShare.create({
      data: {
        courseId,
        shareToken: randomUUID(),
        isGalleryListed: true,
        expiresAt: null,
      },
    });

    return NextResponse.json(share, { status: 201 });
  } catch (error) {
    console.error("Failed to create gallery listing:", error);
    return NextResponse.json({ error: "Failed to create gallery listing" }, { status: 500 });
  }
}
