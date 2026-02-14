import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * GET /api/gallery — List gallery courses (public, no auth required)
 * Query params: page, limit, topic, difficulty, sort (stars/clones/recent), search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 12)));
    const topic = searchParams.get("topic") ?? undefined;
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
    if (topic) courseWhere.topic = topic;
    if (subject) courseWhere.subject = subject;
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

    // Get distinct topics and difficulties for filters
    const allListings = await prisma.courseShare.findMany({
      where: { isGalleryListed: true, isActive: true },
      select: { course: { select: { topic: true, subject: true, difficulty: true } } },
    });
    const topics = [...new Set(allListings.map((s) => s.course.topic))].sort();
    const subjects = [...new Set(allListings.map((s) => s.course.subject))].sort();
    const difficulties = [...new Set(allListings.map((s) => s.course.difficulty))].sort();

    return NextResponse.json({
      items: shares,
      featured,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      filters: { topics, subjects, difficulties },
    });
  } catch (error) {
    console.error("Failed to list gallery:", error);
    return NextResponse.json({ error: "Failed to list gallery" }, { status: 500 });
  }
}
