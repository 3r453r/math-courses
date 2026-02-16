import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

/**
 * PATCH /api/admin/users/[userId] — Update user role or access status (admin only)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { error: authError } = await requireOwner();
  if (authError) return authError;

  try {
    const { userId } = await params;
    const body = await request.json();

    // Prevent modification of owner accounts
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (targetUser?.role === "owner") {
      return NextResponse.json(
        { error: "Cannot modify owner accounts" },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.role !== undefined) {
      if (!["user", "admin", "owner"].includes(body.role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      updateData.role = body.role;
    }

    if (body.accessStatus !== undefined) {
      if (!["pending", "active", "suspended"].includes(body.accessStatus)) {
        return NextResponse.json({ error: "Invalid access status" }, { status: 400 });
      }
      updateData.accessStatus = body.accessStatus;
      if (body.accessStatus === "active") {
        updateData.accessGrantedAt = new Date();
        updateData.accessSource = "admin_grant";
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accessStatus: true,
        accessGrantedAt: true,
        accessSource: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
