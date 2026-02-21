import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";

const GALLERY_STRUCTURE_RATE_LIMIT = {
  namespace: "public:gallery:structure",
  windowMs: 60_000,
  maxRequests: 40,
} as const;

/**
 * GET /api/gallery/[shareToken]/lessons — Lesson structure for a gallery course (public, no auth)
 * Returns lesson titles and DAG edges for the expandable lesson preview on gallery cards.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const rateLimitResponse = enforceRateLimit({
    request,
    route: "/api/gallery/[shareToken]/lessons",
    config: GALLERY_STRUCTURE_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { shareToken } = await params;

    const share = await prisma.courseShare.findFirst({
      where: { shareToken, isGalleryListed: true, isActive: true },
      select: {
        course: {
          select: {
            lessons: {
              select: { id: true, title: true, orderIndex: true },
              orderBy: { orderIndex: "asc" },
            },
            edges: {
              select: { fromLessonId: true, toLessonId: true, relationship: true },
            },
          },
        },
      },
    });

    if (!share) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        lessons: share.course.lessons,
        edges: share.course.edges,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch gallery lesson structure:", error);
    return NextResponse.json({ error: "Failed to fetch lessons" }, { status: 500 });
  }
}
