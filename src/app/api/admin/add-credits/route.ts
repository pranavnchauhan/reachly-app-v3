import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { clientId, amount } = await request.json();

  const supabase = createAdminClient();

  // Create credit pack
  const { data: pack, error: packError } = await supabase
    .from("credit_packs")
    .insert({
      client_id: clientId,
      total_credits: amount,
      used_credits: 0,
    })
    .select()
    .single();

  if (packError) {
    return NextResponse.json({ error: packError.message }, { status: 500 });
  }

  // Record transaction
  await supabase.from("credit_transactions").insert({
    client_id: clientId,
    credit_pack_id: pack.id,
    type: "purchase",
    amount,
    description: `Added ${amount} credits (admin)`,
  });

  return NextResponse.json({ pack });
}
