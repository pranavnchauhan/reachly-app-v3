import { NextResponse } from "next/server";
import { stripe, CREDIT_PACKS } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { user_id, company_id, pack_id, credits } = session.metadata || {};

    if (!credits || !user_id) {
      console.error("Missing metadata in Stripe session:", session.id);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const creditAmount = parseInt(credits, 10);
    const pack = CREDIT_PACKS.find((p) => p.id === pack_id);
    const supabase = createAdminClient();

    // Create credit pack
    const { data: creditPack, error: packError } = await supabase
      .from("credit_packs")
      .insert({
        company_id: company_id || null,
        client_id: user_id,
        total_credits: creditAmount,
        used_credits: 0,
        stripe_session_id: session.id,
      })
      .select()
      .single();

    if (packError) {
      console.error("Failed to create credit pack:", packError);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    // Record transaction
    await supabase.from("credit_transactions").insert({
      company_id: company_id || null,
      client_id: user_id,
      credit_pack_id: creditPack.id,
      type: "purchase",
      amount: creditAmount,
      description: `Purchased ${pack?.label || creditAmount + " credits"} via Stripe ($${(session.amount_total! / 100).toFixed(2)} AUD)`,
    });

    console.log(`[STRIPE] Credits added: ${creditAmount} for user ${user_id} (company: ${company_id || "none"}) — session: ${session.id}`);
  }

  return NextResponse.json({ received: true });
}
