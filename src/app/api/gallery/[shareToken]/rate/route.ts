import { prisma } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

const GALLERY_RATE_RATE_LIMIT = {
  namespace: "gallery:rate",
  windowMs: 60_000,
  maxRequests: 20,
} as const;

/**
 * POST /api/gallery/[shareToken]/rate — Create or update a rating (1-5)
 * Updates the denormalized starCount on CourseShare.
 * Requires active access.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { userId, error: authError } = await getAuthUserFromRequest(request);
  if (authError) return authError;

  const rateLimitResponse = enforceRateLimit({
    request,
    userId,
    route: "/api/gallery/rate",
    config: GALLERY_RATE_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { shareToken } = await params;
    const { data: body, error: parseError } = await parseBody(request, ratingSchema);
    if (parseError) return parseError;

    const { rating } = body;

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
