import { prisma } from "@/lib/db";
import { getAuthUser, getAuthUserFromRequest, verifyCourseOwnership } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { enforceRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const createShareSchema = z.object({
  expiresAt: z.string().datetime().nullable().optional(),
});

const deleteShareSchema = z.object({
  shareId: z.string().min(1, "shareId required").max(50),
});

const COURSE_SHARE_MUTATION_RATE_LIMIT = {
  namespace: "courses:share:mutation",
  windowMs: 60_000,
  maxRequests: 20,
} as const;

/** Create a share link for a course */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { userId, error: authError } = await getAuthUserFromRequest(request);
  if (authError) return authError;

  const rateLimitResponse = enforceRateLimit({
    request,
    userId,
    route: "/api/courses/[courseId]/share",
    config: COURSE_SHARE_MUTATION_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { courseId } = await params;
    const { error: ownerError } = await verifyCourseOwnership(courseId, userId);
    if (ownerError) return ownerError;

    const { data: body, error: parseError } = await parseBody(request, createShareSchema);
    if (parseError) return parseError;

    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const share = await prisma.courseShare.create({
      data: {
        courseId,
        shareToken: randomUUID(),
        expiresAt,
      },
    });

    return NextResponse.json({
      id: share.id,
      shareToken: share.shareToken,
      isActive: share.isActive,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      createdAt: share.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create share link:", error);
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }
}

/** List all share links for a course */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { userId, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { courseId } = await params;
    const { error: ownerError } = await verifyCourseOwnership(courseId, userId);
    if (ownerError) return ownerError;

    const shares = await prisma.courseShare.findMany({
      where: { courseId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      shares.map((s) => ({
        id: s.id,
        shareToken: s.shareToken,
        isActive: s.isActive,
        expiresAt: s.expiresAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Failed to list share links:", error);
    return NextResponse.json({ error: "Failed to list share links" }, { status: 500 });
  }
}

/** Revoke a share link */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { userId, error: authError } = await getAuthUserFromRequest(request);
  if (authError) return authError;

  const rateLimitResponse = enforceRateLimit({
    request,
    userId,
    route: "/api/courses/[courseId]/share",
    config: COURSE_SHARE_MUTATION_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { courseId } = await params;
    const { error: ownerError } = await verifyCourseOwnership(courseId, userId);
    if (ownerError) return ownerError;

    const { data: deleteBody, error: parseError } = await parseBody(request, deleteShareSchema);
    if (parseError) return parseError;

    const { shareId } = deleteBody;

    const share = await prisma.courseShare.findUnique({ where: { id: shareId } });
    if (!share || share.courseId !== courseId) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    await prisma.courseShare.update({
      where: { id: shareId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to revoke share link:", error);
    return NextResponse.json({ error: "Failed to revoke share link" }, { status: 500 });
  }
}
