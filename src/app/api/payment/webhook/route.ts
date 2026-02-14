import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * POST /api/payment/webhook — Stripe webhook handler
 * Verifies Stripe signature. On checkout.session.completed:
 * generates access code, redeems for user, sets active.
 * No auth required (uses Stripe signature verification).
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;

    if (!userId) {
      console.error("No userId in checkout session metadata");
      return NextResponse.json({ received: true });
    }

    try {
      // Generate a unique access code for audit trail
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const bytes = crypto.randomBytes(8);
      let codeStr = "PAY-";
      for (let i = 0; i < 8; i++) {
        codeStr += chars[bytes[i] % chars.length];
      }

      // Create access code, redemption, payment record, and activate user
      const accessCode = await prisma.accessCode.create({
        data: {
          code: codeStr,
          type: "payment",
          maxUses: 1,
          currentUses: 1,
          isActive: false, // Already used
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
    } catch (error) {
      console.error("Failed to process payment webhook:", error);
      // Return 200 to prevent Stripe retries — we log the error for manual resolution
    }
  }

  return NextResponse.json({ received: true });
}
