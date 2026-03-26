import { NextResponse } from "next/server";
import { getStripe, CREDIT_PACKS } from "@/lib/stripe";
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
    event = getStripe().webhooks.constructEvent(
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
    const validityMonths = pack?.validityMonths ?? 4;
    const supabase = createAdminClient();

    // Calculate expiry date
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + validityMonths);

    // ─── Rollover: find existing packs with remaining credits ────────
    let rolledOverCredits = 0;
    const ownerFilter = company_id
      ? { company_id }
      : { client_id: user_id };

    // Get all active (non-expired or has remaining) packs for this owner
    let query = supabase
      .from("credit_packs")
      .select("id, total_credits, used_credits, expires_at")
      .gt("total_credits", 0); // has credits allocated

    if (company_id) {
      query = query.eq("company_id", company_id);
    } else {
      query = query.eq("client_id", user_id).is("company_id", null);
    }

    const { data: existingPacks } = await query;

    if (existingPacks) {
      for (const existing of existingPacks) {
        const remaining = existing.total_credits - existing.used_credits;
        if (remaining <= 0) continue;

        // Roll over remaining credits
        rolledOverCredits += remaining;

        // Mark old pack as fully used (rolled over)
        await supabase
          .from("credit_packs")
          .update({ used_credits: existing.total_credits })
          .eq("id", existing.id);

        // Log rollover transaction on old pack
        await supabase.from("credit_transactions").insert({
          company_id: company_id || null,
          client_id: user_id,
          credit_pack_id: existing.id,
          type: "debit",
          amount: remaining,
          description: `Rolled over ${remaining} credits to new ${pack?.label || "pack"}`,
        });
      }
    }

    const totalCreditsWithRollover = creditAmount + rolledOverCredits;

    // ─── Create new credit pack with rolled-over credits ─────────────
    const { data: creditPack, error: packError } = await supabase
      .from("credit_packs")
      .insert({
        company_id: company_id || null,
        client_id: user_id,
        total_credits: totalCreditsWithRollover,
        used_credits: 0,
        expires_at: expiresAt.toISOString(),
        stripe_session_id: session.id,
      })
      .select()
      .single();

    if (packError) {
      console.error("Failed to create credit pack:", packError);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    // Record purchase transaction
    await supabase.from("credit_transactions").insert({
      company_id: company_id || null,
      client_id: user_id,
      credit_pack_id: creditPack.id,
      type: "purchase",
      amount: totalCreditsWithRollover,
      description: rolledOverCredits > 0
        ? `Purchased ${pack?.label || creditAmount + " credits"} ($${(session.amount_total! / 100).toFixed(2)} AUD) + ${rolledOverCredits} rolled over`
        : `Purchased ${pack?.label || creditAmount + " credits"} ($${(session.amount_total! / 100).toFixed(2)} AUD)`,
    });

    console.log(
      `[STRIPE] Credits added: ${totalCreditsWithRollover} (${creditAmount} new + ${rolledOverCredits} rollover) for user ${user_id} — expires ${expiresAt.toISOString()} — session: ${session.id}`
    );
  }

  return NextResponse.json({ received: true });
}
