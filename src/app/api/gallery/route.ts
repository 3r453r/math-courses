import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseSubjects } from "@/lib/subjects";

/**
 * GET /api/gallery — List gallery courses (public, no auth required)
 * Query params: page, limit, language, difficulty, sort (stars/clones/recent), search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 12)));
    const language = searchParams.get("language") ?? undefined;
    const subject = searchParams.get("subject") ?? undefined;
    const difficulty = searchParams.get("difficulty") ?? undefined;
    const sort = searchParams.get("sort") ?? "recent";
    const search = searchParams.get("search") ?? undefined;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      isGalleryListed: true,
      isActive: true,
    };

    // Course-level filters via nested relation
    const courseWhere: Record<string, unknown> = {};
    if (language) courseWhere.language = language;
    if (subject) courseWhere.subject = { contains: `"${subject}"` };
    if (difficulty) courseWhere.difficulty = difficulty;
    if (search) {
      courseWhere.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { topic: { contains: search } },
      ];
    }
    if (Object.keys(courseWhere).length > 0) {
      where.course = courseWhere;
    }

    // Sort
    let orderBy: Record<string, string> = { createdAt: "desc" };
    if (sort === "stars") orderBy = { starCount: "desc" };
    else if (sort === "clones") orderBy = { cloneCount: "desc" };

    const courseSelect = {
      title: true as const,
      description: true as const,
      topic: true as const,
      subject: true as const,
      difficulty: true as const,
      language: true as const,
      _count: { select: { lessons: true as const } },
      user: { select: { name: true as const } },
    };

    const shareInclude = { course: { select: courseSelect } };

    // Fetch featured courses first (page 1 only) so we can exclude them from main query
    let featured: Awaited<ReturnType<typeof prisma.courseShare.findMany<{ include: typeof shareInclude }>>> = [];
    if (page === 1) {
      featured = await prisma.courseShare.findMany({
        where: {
          isGalleryListed: true,
          isActive: true,
          featuredAt: { not: null },
        },
        orderBy: { featuredAt: "desc" },
        take: 6,
        include: shareInclude,
      });
    }

    // On page 1, exclude featured items from main query to avoid duplicates
    const featuredIds = featured.map((f) => f.id);
    const mainWhere = featuredIds.length > 0
      ? { ...where, id: { notIn: featuredIds } }
      : where;

    const [shares, total] = await Promise.all([
      prisma.courseShare.findMany({
        where: mainWhere,
        orderBy,
        skip,
        take: limit,
        include: shareInclude,
      }),
      prisma.courseShare.count({ where: mainWhere }),
    ]);

    // Get distinct filter options from gallery-listed courses
    const allListings = await prisma.courseShare.findMany({
      where: { isGalleryListed: true, isActive: true },
      select: { course: { select: { subject: true, difficulty: true, language: true } } },
    });
    const subjects = [...new Set(allListings.flatMap((s) => parseSubjects(s.course.subject)))].sort();
    const difficulties = [...new Set(allListings.map((s) => s.course.difficulty))].sort();
    const languages = [...new Set(allListings.map((s) => s.course.language).filter(Boolean))].sort();

    // Add hasPreview flag and attribution info
    const items = shares.map((s) => ({
      ...s,
      hasPreview: s.previewLessonId != null,
      creatorName: s.creatorClaimed ? s.course.user.name : null,
    }));
    const featuredItems = featured.map((s) => ({
      ...s,
      hasPreview: s.previewLessonId != null,
      creatorName: s.creatorClaimed ? s.course.user.name : null,
    }));

    return NextResponse.json(
      {
        items,
        featured: featuredItems,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        filters: { subjects, difficulties, languages },
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Failed to list gallery:", error);
    return NextResponse.json({ error: "Failed to list gallery" }, { status: 500 });
  }
}
