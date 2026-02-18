import { prisma } from "@/lib/db";
import { requireOwnerFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

/**
 * DELETE /api/access-codes/[codeId] — Deactivate an access code (admin only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ codeId: string }> }
) {
  const { error: authError } = await requireOwnerFromRequest(request);
  if (authError) return authError;

  try {
    const { codeId } = await params;

    await prisma.accessCode.update({
      where: { id: codeId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to deactivate access code:", error);
    return NextResponse.json({ error: "Failed to deactivate access code" }, { status: 500 });
  }
}
