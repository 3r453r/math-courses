import { getAuthUserAnyStatusFromRequest } from "@/lib/auth-utils";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * POST /api/payment/verify — Verify a Stripe checkout session and activate user.
 * Called by the success page as a fallback when the webhook hasn't fired yet.
 * Idempotent: if the user is already active or the payment already recorded, it's a no-op.
 */
export async function POST(request: Request) {
  // Only available when webhook is not configured (dev/testing)
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { userId, error: authError } = await getAuthUserAnyStatusFromRequest(request);
  if (authError) return authError;

  const { sessionId } = await request.json();
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  // Check if this payment was already processed
  const existingPayment = await prisma.payment.findFirst({
    where: { stripeSessionId: sessionId },
  });
  if (existingPayment) {
    return NextResponse.json({ status: "already_processed" });
  }

  // Retrieve the session from Stripe to verify payment
  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
  }

  // Verify the session belongs to this user
  if (session.metadata?.userId !== userId) {
    return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
  }

  // Activate user — same logic as webhook
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let codeStr = "PAY-";
  for (let i = 0; i < 8; i++) {
    codeStr += chars[bytes[i] % chars.length];
  }

  const accessCode = await prisma.accessCode.create({
    data: {
      code: codeStr,
      type: "payment",
      maxUses: 1,
      currentUses: 1,
      isActive: false,
    },
  });

  await prisma.$transaction([
    prisma.accessCodeRedemption.create({
      data: { accessCodeId: accessCode.id, userId },
    }),
    prisma.payment.create({
      data: {
        userId,
        stripeSessionId: session.id,
        amount: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        status: "completed",
        accessCodeId: accessCode.id,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        accessStatus: "active",
        accessGrantedAt: new Date(),
        accessSource: "stripe",
      },
    }),
  ]);

  return NextResponse.json({ status: "activated" });
}
