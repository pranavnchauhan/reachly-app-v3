import { NextResponse } from "next/server";
import { getStripe, CREDIT_PACKS } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { packId } = await request.json();

  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
  }

  // Get current user and their company
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, full_name, company_name")
    .eq("id", user.id)
    .single();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.reachly.com.au";

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    currency: "aud",
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "aud",
          product_data: {
            name: `Reachly Credits — ${pack.label}`,
            description: `${pack.credits} lead reveal credits for ${profile?.company_name || "your account"}`,
          },
          unit_amount: pack.price,
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_id: user.id,
      company_id: profile?.company_id || "",
      pack_id: pack.id,
      credits: String(pack.credits),
    },
    success_url: `${appUrl}/dashboard/credits?purchased=${pack.credits}`,
    cancel_url: `${appUrl}/dashboard/buy-credits`,
  });

  return NextResponse.json({ url: session.url });
}
