import { getAuthUserAnyStatus } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { CURRENT_TOS_VERSION } from "@/app/api/user/tos/route";

/**
 * GET /api/user/status
 * Returns the current user's access status, role, and ToS acceptance state.
 * Accessible to any authenticated user (including pending).
 */
export async function GET() {
  const { userId, role, accessStatus, error } = await getAuthUserAnyStatus();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tosAcceptedAt: true, tosVersion: true },
  });

  const tosAccepted = user?.tosVersion === CURRENT_TOS_VERSION;

  return NextResponse.json({ userId, role, accessStatus, tosAccepted });
}
