import { prisma } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const updateGallerySchema = z.object({
  isGalleryListed: z.boolean().optional(),
  featuredAt: z.string().datetime().nullable().optional(),
  tags: z.string().max(500).nullable().optional(),
  galleryTitle: z.string().max(200).nullable().optional(),
  galleryDescription: z.string().max(2000).nullable().optional(),
  previewLessonId: z.string().max(50).nullable().optional(),
  cloneConflictAction: z.enum(["replace", "add"]).optional(),
});

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
 * PATCH /api/admin/gallery/[shareId] — Update gallery listing (admin only)
 * Set isGalleryListed, featuredAt, tags, remove expiry when listing.
 * Validates that the course is fully generated before allowing gallery listing.
 * Detects clone conflicts when listing a course that shares lineage with an existing listing.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { role, error: authError } = await requireAdminFromRequest(request);
  if (authError) return authError;

  try {
    const { shareId } = await params;
    const { data: body, error: parseError } = await parseBody(request, updateGallerySchema);
    if (parseError) return parseError;

    const updateData: Record<string, unknown> = {};

    if (body.isGalleryListed !== undefined) {
      // When adding to gallery, validate course is fully generated
      if (body.isGalleryListed) {
        const share = await prisma.courseShare.findUnique({
          where: { id: shareId },
          include: {
            course: {
              select: {
                id: true,
                status: true,
                clonedFromId: true,
                lessons: {
                  where: { isSupplementary: false },
                  select: { status: true, contentJson: true },
                },
              },
            },
          },
        });

        if (!share) {
          return NextResponse.json({ error: "Share not found" }, { status: 404 });
        }

        const lessons = share.course.lessons;
        const allGenerated = lessons.length > 0 &&
          lessons.every((l) => l.status !== "pending" && l.contentJson !== null);

        if (!allGenerated && role !== "owner") {
          return NextResponse.json(
            { error: "Course must be fully generated before adding to gallery" },
            { status: 400 }
          );
        }

        // Clone conflict detection
        const conflict = await findCloneConflict(share.course.id);
        if (conflict) {
          // If no action specified, return the conflict for the admin to decide
          if (!body.cloneConflictAction) {
            return NextResponse.json({
              cloneConflict: true,
              conflictingShare: {
                id: conflict.id,
                shareToken: conflict.shareToken,
                course: conflict.course,
              },
            });
          }

          // Replace: delist the conflicting share, then list the new one
          if (body.cloneConflictAction === "replace") {
            await prisma.courseShare.update({
              where: { id: conflict.id },
              data: { isGalleryListed: false },
            });
          }
          // "add": proceed normally (list alongside)
        }

        updateData.expiresAt = null;
      }
      updateData.isGalleryListed = Boolean(body.isGalleryListed);
    }

    if (body.featuredAt !== undefined) {
      updateData.featuredAt = body.featuredAt ? new Date(body.featuredAt) : null;
    }

    if (body.tags !== undefined) {
      updateData.tags = body.tags;
    }

    if (body.galleryTitle !== undefined) {
      updateData.galleryTitle = body.galleryTitle;
    }

    if (body.galleryDescription !== undefined) {
      updateData.galleryDescription = body.galleryDescription;
    }

    if (body.previewLessonId !== undefined) {
      if (body.previewLessonId === null) {
        updateData.previewLessonId = null;
      } else {
        // Validate the lesson belongs to the share's course
        const shareForValidation = await prisma.courseShare.findUnique({
          where: { id: shareId },
          select: { courseId: true },
        });
        if (shareForValidation) {
          const lesson = await prisma.lesson.findFirst({
            where: { id: body.previewLessonId, courseId: shareForValidation.courseId },
          });
          if (!lesson) {
            return NextResponse.json(
              { error: "Lesson does not belong to this course" },
              { status: 400 }
            );
          }
        }
        updateData.previewLessonId = body.previewLessonId;
      }
    }

    const share = await prisma.courseShare.update({
      where: { id: shareId },
      data: updateData,
    });

    return NextResponse.json(share);
  } catch (error) {
    console.error("Failed to update gallery listing:", error);
    return NextResponse.json({ error: "Failed to update gallery listing" }, { status: 500 });
  }
}
