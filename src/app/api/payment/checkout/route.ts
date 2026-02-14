import { getAuthUserAnyStatus } from "@/lib/auth-utils";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

/**
 * POST /api/payment/checkout — Create a Stripe Checkout Session
 * Accessible to pending users (any-status auth).
 */
export async function POST(request: Request) {
  const { userId, error: authError } = await getAuthUserAnyStatus();
  if (authError) return authError;

  try {
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json({ error: "Payment not configured" }, { status: 500 });
    }

    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
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
