import { prisma } from "@/lib/db";
import { requireOwnerFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const updateUserSchema = z.object({
  role: z.enum(["user", "admin", "owner"]).optional(),
  accessStatus: z.enum(["pending", "active", "suspended"]).optional(),
}).refine((data) => data.role !== undefined || data.accessStatus !== undefined, {
  message: "At least one of role or accessStatus must be provided",
});

/**
 * PATCH /api/admin/users/[userId] — Update user role or access status (admin only)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { error: authError } = await requireOwnerFromRequest(request);
  if (authError) return authError;

  try {
    const { userId } = await params;
    const { data: body, error: parseError } = await parseBody(request, updateUserSchema);
    if (parseError) return parseError;

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
      updateData.role = body.role;
    }

    if (body.accessStatus !== undefined) {
      updateData.accessStatus = body.accessStatus;
      if (body.accessStatus === "active") {
        updateData.accessGrantedAt = new Date();
        updateData.accessSource = "admin_grant";
      }
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
