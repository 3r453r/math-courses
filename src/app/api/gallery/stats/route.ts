import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/gallery/stats — Public gallery aggregate stats (no auth)
 */
export async function GET() {
  try {
    const [totalCourses, ratingAgg] = await Promise.all([
      prisma.courseShare.count({
        where: { isGalleryListed: true, isActive: true },
      }),
      prisma.courseRating.aggregate({
        _count: { id: true },
        _avg: { rating: true },
      }),
    ]);

    return NextResponse.json({
      totalCourses,
      totalRatings: ratingAgg._count.id,
      averageRating: ratingAgg._avg.rating
        ? Math.round(ratingAgg._avg.rating * 10) / 10
        : null,
    });
  } catch (error) {
    console.error("Failed to get gallery stats:", error);
    return NextResponse.json({ error: "Failed to get stats" }, { status: 500 });
  }
}
