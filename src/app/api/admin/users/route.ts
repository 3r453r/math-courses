import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/users — List all users with role and access info (admin only)
 */
export async function GET() {
  const { error: authError } = await requireOwner();
  if (authError) return authError;

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        accessStatus: true,
        accessGrantedAt: true,
        accessSource: true,
        createdAt: true,
        _count: { select: { courses: true } },
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to list users:", error);
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}
