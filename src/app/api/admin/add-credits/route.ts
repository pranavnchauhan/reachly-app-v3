import { requireAdmin } from "@/lib/auth-guard";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response;

  const { companyId, clientId, amount, description, validityMonths } = await request.json();

  if (!amount || amount < 1) {
    return NextResponse.json({ error: "Amount must be at least 1" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Calculate expiry (default 4 months if not specified)
  const months = validityMonths || 4;
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + months);

  // Create credit pack
  const { data: pack, error: packError } = await supabase
    .from("credit_packs")
    .insert({
      company_id: companyId || null,
      client_id: clientId || null,
      total_credits: amount,
      used_credits: 0,
      expires_at: expiresAt.toISOString(),
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
    description: description || `Added ${amount} credits (admin) — valid for ${months} months`,
  });

  return NextResponse.json({ pack });
}
