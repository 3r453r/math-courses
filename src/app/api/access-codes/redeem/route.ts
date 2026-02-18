import { prisma } from "@/lib/db";
import { getAuthUserAnyStatusFromRequest } from "@/lib/auth-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

const ACCESS_CODE_REDEEM_RATE_LIMIT = {
  namespace: "access-codes:redeem",
  windowMs: 60_000,
  maxRequests: 5,
} as const;

/**
 * POST /api/access-codes/redeem
 * Validate an access code, increment usage, create redemption, set user active.
 * Accessible to pending users (any-status auth).
 */
export async function POST(request: Request) {
  const { userId, error: authError } = await getAuthUserAnyStatusFromRequest(request);
  if (authError) return authError;

  const rateLimitResponse = enforceRateLimit({
    request,
    userId,
    route: "/api/access-codes/redeem",
    config: ACCESS_CODE_REDEEM_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { code } = await request.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Access code is required" }, { status: 400 });
    }

    const trimmedCode = code.trim().toUpperCase();

    const accessCode = await prisma.accessCode.findUnique({
      where: { code: trimmedCode },
    });

    if (!accessCode) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 400 });
    }

    // Check if user is already active
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { accessStatus: true },
    });

    if (user?.accessStatus === "active") {
      return NextResponse.json({ error: "Your account is already active" }, { status: 400 });
    }

    try {
      await prisma.$transaction(async (tx) => {
        const now = new Date();
        const updated = await tx.accessCode.updateMany({
          where: {
            id: accessCode.id,
            isActive: true,
            currentUses: { lt: accessCode.maxUses },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          data: { currentUses: { increment: 1 } },
        });

        if (updated.count === 0) {
          throw new Error("INVALID_OR_EXPIRED_OR_EXHAUSTED");
        }

        await tx.accessCodeRedemption.create({
          data: { accessCodeId: accessCode.id, userId },
        });

        await tx.user.update({
          where: { id: userId },
          data: {
            accessStatus: "active",
            accessGrantedAt: now,
            accessSource: "code",
          },
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_OR_EXPIRED_OR_EXHAUSTED") {
        return NextResponse.json({ error: "Invalid, expired, or exhausted access code" }, { status: 400 });
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json({ error: "You have already redeemed this code" }, { status: 400 });
      }

      throw error;
    }

    return NextResponse.json({ success: true, message: "Access granted" });
  } catch (error) {
    console.error("Failed to redeem access code:", error);
    return NextResponse.json({ error: "Failed to redeem access code" }, { status: 500 });
  }
}
