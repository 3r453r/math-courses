import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

/**
 * POST /api/gallery/[shareToken]/rate — Create or update a rating (1-5)
 * Updates the denormalized starCount on CourseShare.
 * Requires active access.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { userId, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { shareToken } = await params;
    const { rating } = await request.json();

    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json({ error: "Rating must be an integer between 1 and 5" }, { status: 400 });
    }

    const share = await prisma.courseShare.findUnique({
      where: { shareToken },
      select: { id: true, isGalleryListed: true, isActive: true },
    });

    if (!share || !share.isActive || !share.isGalleryListed) {
      return NextResponse.json({ error: "Gallery listing not found" }, { status: 404 });
    }

    // Upsert rating
    await prisma.courseRating.upsert({
      where: { courseShareId_userId: { courseShareId: share.id, userId } },
      create: { courseShareId: share.id, userId, rating },
      update: { rating },
    });

    // Recalculate average star rating (stored as rounded average * count for simplicity)
    const agg = await prisma.courseRating.aggregate({
      where: { courseShareId: share.id },
      _avg: { rating: true },
      _count: true,
    });

    const avgRating = Math.round((agg._avg.rating ?? 0) * 10) / 10;

    await prisma.courseShare.update({
      where: { id: share.id },
      data: { starCount: agg._count },
    });

    return NextResponse.json({
      success: true,
      averageRating: avgRating,
      totalRatings: agg._count,
    });
  } catch (error) {
    console.error("Failed to rate course:", error);
    return NextResponse.json({ error: "Failed to rate course" }, { status: 500 });
  }
}
