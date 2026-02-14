import { prisma } from "@/lib/db";
import { getAuthUser, verifyCourseOwnership } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

/** Create a share link for a course */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { userId, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { courseId } = await params;
    const { error: ownerError } = await verifyCourseOwnership(courseId, userId);
    if (ownerError) return ownerError;

    const body = await request.json().catch(() => ({}));
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
  request: Request,
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
  const { userId, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { courseId } = await params;
    const { error: ownerError } = await verifyCourseOwnership(courseId, userId);
    if (ownerError) return ownerError;

    const { shareId } = await request.json();
    if (!shareId) {
      return NextResponse.json({ error: "shareId required" }, { status: 400 });
    }

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
