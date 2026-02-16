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

    const [shares, total] = await Promise.all([
      prisma.courseShare.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          course: {
            select: {
              title: true,
              description: true,
              topic: true,
              subject: true,
              difficulty: true,
              language: true,
              _count: { select: { lessons: true } },
              user: { select: { name: true } },
            },
          },
        },
      }),
      prisma.courseShare.count({ where }),
    ]);

    // Also get featured courses for the first page
    let featured: typeof shares = [];
    if (page === 1) {
      featured = await prisma.courseShare.findMany({
        where: {
          isGalleryListed: true,
          isActive: true,
          featuredAt: { not: null },
        },
        orderBy: { featuredAt: "desc" },
        take: 6,
        include: {
          course: {
            select: {
              title: true,
              description: true,
              topic: true,
              subject: true,
              difficulty: true,
              language: true,
              _count: { select: { lessons: true } },
              user: { select: { name: true } },
            },
          },
        },
      });
    }

    // Get distinct filter options from gallery-listed courses
    const allListings = await prisma.courseShare.findMany({
      where: { isGalleryListed: true, isActive: true },
      select: { course: { select: { subject: true, difficulty: true, language: true } } },
    });
    const subjects = [...new Set(allListings.flatMap((s) => parseSubjects(s.course.subject)))].sort();
    const difficulties = [...new Set(allListings.map((s) => s.course.difficulty))].sort();
    const languages = [...new Set(allListings.map((s) => s.course.language).filter(Boolean))].sort();

    // Add hasPreview flag derived from previewLessonId
    const items = shares.map((s) => ({
      ...s,
      hasPreview: s.previewLessonId != null,
    }));
    const featuredItems = featured.map((s) => ({
      ...s,
      hasPreview: s.previewLessonId != null,
    }));

    return NextResponse.json({
      items,
      featured: featuredItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      filters: { subjects, difficulties, languages },
    });
  } catch (error) {
    console.error("Failed to list gallery:", error);
    return NextResponse.json({ error: "Failed to list gallery" }, { status: 500 });
  }
}
