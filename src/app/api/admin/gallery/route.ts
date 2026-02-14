import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/gallery — List all active share links with eligibility info (admin only)
 * Used for gallery curation — admin can promote any share to a gallery listing.
 * Courses must be fully generated (all non-supplementary lessons have content) to be eligible.
 */
export async function GET() {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const shares = await prisma.courseShare.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: {
        course: {
          select: {
            title: true,
            topic: true,
            subject: true,
            difficulty: true,
            status: true,
            clonedFromId: true,
            user: { select: { name: true, email: true } },
            lessons: {
              where: { isSupplementary: false },
              select: { id: true, status: true, contentJson: true },
            },
          },
        },
      },
    });

    // Add eligibility info to each share
    const result = shares.map((share) => {
      const lessons = share.course.lessons;
      const totalLessons = lessons.length;
      const generatedLessons = lessons.filter(
        (l) => l.status !== "pending" && l.contentJson !== null
      ).length;
      const isEligible = share.course.status === "ready" && totalLessons > 0 && generatedLessons === totalLessons;

      // Remove raw lesson data from response
      const { lessons: _lessons, ...courseWithoutLessons } = share.course;

      return {
        ...share,
        course: courseWithoutLessons,
        eligibility: {
          isEligible,
          totalLessons,
          generatedLessons,
        },
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to list shares for gallery:", error);
    return NextResponse.json({ error: "Failed to list shares" }, { status: 500 });
  }
}
