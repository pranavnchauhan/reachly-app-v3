import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { companyId, clientId, amount, description } = await request.json();

  if (!amount || amount < 1) {
    return NextResponse.json({ error: "Amount must be at least 1" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Create credit pack (company-level or user-level)
  const { data: pack, error: packError } = await supabase
    .from("credit_packs")
    .insert({
      company_id: companyId || null,
      client_id: clientId || null,
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
    company_id: companyId || null,
    client_id: clientId || null,
    credit_pack_id: pack.id,
    type: "purchase",
    amount,
    description: description || `Added ${amount} credits (admin)`,
  });

  return NextResponse.json({ pack });
}
