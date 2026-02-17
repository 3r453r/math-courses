import { prisma } from "@/lib/db";
import { getAuthUserAnyStatusFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

/**
 * POST /api/access-codes/redeem
 * Validate an access code, increment usage, create redemption, set user active.
 * Accessible to pending users (any-status auth).
 */
export async function POST(request: Request) {
  const { userId, error: authError } = await getAuthUserAnyStatusFromRequest(request);
  if (authError) return authError;

  try {
    const { code } = await request.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Access code is required" }, { status: 400 });
    }

    const trimmedCode = code.trim().toUpperCase();

    const accessCode = await prisma.accessCode.findUnique({
      where: { code: trimmedCode },
    });

    if (!accessCode || !accessCode.isActive) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 400 });
    }

    if (accessCode.expiresAt && accessCode.expiresAt < new Date()) {
      return NextResponse.json({ error: "Access code has expired" }, { status: 400 });
    }

    if (accessCode.currentUses >= accessCode.maxUses) {
      return NextResponse.json({ error: "Access code has reached maximum uses" }, { status: 400 });
    }

    // Check if user already redeemed this code
    const existing = await prisma.accessCodeRedemption.findUnique({
      where: { accessCodeId_userId: { accessCodeId: accessCode.id, userId } },
    });

    if (existing) {
      return NextResponse.json({ error: "You have already redeemed this code" }, { status: 400 });
    }

    // Check if user is already active
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { accessStatus: true },
    });

    if (user?.accessStatus === "active") {
      return NextResponse.json({ error: "Your account is already active" }, { status: 400 });
    }

    // Redeem: increment usage, create redemption, activate user
    await prisma.$transaction([
      prisma.accessCode.update({
        where: { id: accessCode.id },
        data: { currentUses: { increment: 1 } },
      }),
      prisma.accessCodeRedemption.create({
        data: { accessCodeId: accessCode.id, userId },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          accessStatus: "active",
          accessGrantedAt: new Date(),
          accessSource: "code",
        },
      }),
    ]);

    return NextResponse.json({ success: true, message: "Access granted" });
  } catch (error) {
    console.error("Failed to redeem access code:", error);
    return NextResponse.json({ error: "Failed to redeem access code" }, { status: 500 });
  }
}
