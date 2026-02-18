import { prisma } from "@/lib/db";
import { getAuthUserAnyStatusFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

export const CURRENT_TOS_VERSION = "1.0";

/**
 * PATCH /api/user/tos — Accept current Terms of Service
 * Accessible to any authenticated user regardless of access status.
 */
export async function PATCH(request: Request) {
  const { userId, error: authError } = await getAuthUserAnyStatusFromRequest(request);
  if (authError) return authError;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        tosAcceptedAt: new Date(),
        tosVersion: CURRENT_TOS_VERSION,
      },
    });

    return NextResponse.json({ accepted: true, version: CURRENT_TOS_VERSION });
  } catch (error) {
    console.error("Failed to accept ToS:", error);
    return NextResponse.json({ error: "Failed to accept Terms of Service" }, { status: 500 });
  }
}
