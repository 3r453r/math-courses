import { getAuthUserAnyStatus } from "@/lib/auth-utils";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * POST /api/payment/checkout — Create a Stripe Checkout Session
 * Accessible to pending users (any-status auth).
 * In dev bypass mode, skips Stripe and directly activates the user.
 */
export async function POST(request: Request) {
  const { userId, error: authError } = await getAuthUserAnyStatus();
  if (authError) return authError;

  // Dev bypass: skip Stripe and directly activate the user
  if (process.env.AUTH_DEV_BYPASS === "true") {
    await prisma.user.update({
      where: { id: userId },
      data: {
        accessStatus: "active",
        accessGrantedAt: new Date(),
        accessSource: "dev_bypass",
      },
    });
    const origin = new URL(request.url).origin;
    return NextResponse.json({ url: `${origin}/payment/success?dev_bypass=true` });
  }

  try {
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json({ error: "Payment not configured" }, { status: 500 });
    }

    const origin = new URL(request.url).origin;

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "blik", "p24"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment/cancel`,
      metadata: { userId },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Failed to create checkout session:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
