import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { cleanupExpiredGenerationLogPayloads } from "@/lib/ai/generationLogRetention";

/**
 * GET /api/admin/generation-logs — Query AI generation logs with filters
 *
 * Query params:
 *   type     — filter by generationType (e.g. "lesson", "quiz")
 *   outcome  — filter by outcome (e.g. "failed", "repaired_layer1")
 *   model    — filter by modelId
 *   courseId — filter by courseId
 *   from     — ISO date string, filter createdAt >= from
 *   to       — ISO date string, filter createdAt <= to
 *   limit    — max rows (default 50, max 200)
 *   offset   — pagination offset (default 0)
 */
export async function GET(request: Request) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    await cleanupExpiredGenerationLogPayloads();
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const outcome = url.searchParams.get("outcome");
    const model = url.searchParams.get("model");
    const courseId = url.searchParams.get("courseId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1),
      200
    );
    const offset = Math.max(
      parseInt(url.searchParams.get("offset") || "0", 10) || 0,
      0
    );

    const where: Record<string, unknown> = {};
    if (type) where.generationType = type;
    if (outcome) where.outcome = outcome;
    if (model) where.modelId = model;
    if (courseId) where.courseId = courseId;

    if (from || to) {
      const createdAt: Record<string, Date> = {};
      if (from) createdAt.gte = new Date(from);
      if (to) createdAt.lte = new Date(to);
      where.createdAt = createdAt;
    }

    const [logs, total, stats] = await Promise.all([
      prisma.aiGenerationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          generationType: true,
          schemaName: true,
          modelId: true,
          provider: true,
          userId: true,
          courseId: true,
          lessonId: true,
          outcome: true,
          durationMs: true,
          layer0Called: true,
          layer0Result: true,
          layer1Called: true,
          layer1Success: true,
          layer1HadWrapper: true,
          layer2Called: true,
          layer2Success: true,
          layer2ModelId: true,
          rawOutputLen: true,
          rawOutputRedacted: true,
          zodErrors: true,
          errorMessage: true,
          promptHash: true,
          promptRedacted: true,
          sensitiveTextExpiresAt: true,
          sensitiveTextRedactedAt: true,
          language: true,
          difficulty: true,
          createdAt: true,
          // Exclude rawOutputText and promptText from list view (large fields)
        },
      }),
      prisma.aiGenerationLog.count({ where }),
      prisma.aiGenerationLog.groupBy({
        by: ["outcome"],
        where,
        _count: { outcome: true },
      }),
    ]);

    const statsMap: Record<string, number> = {};
    for (const row of stats) {
      statsMap[row.outcome] = row._count.outcome;
    }

    return NextResponse.json({ logs, total, limit, offset, stats: statsMap });
  } catch (error) {
    console.error("Failed to fetch generation logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch generation logs" },
      { status: 500 }
    );
  }
}
