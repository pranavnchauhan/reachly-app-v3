import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  const { leadId, clientId } = await request.json();

  // Verify lead is published and belongs to client's niche
  const { data: lead } = await supabase
    .from("leads")
    .select("*, client_niches!inner(client_id)")
    .eq("id", leadId)
    .eq("status", "published")
    .single();

  if (!lead || lead.client_niches.client_id !== clientId) {
    return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
  }

  // Find active credit pack with available credits
  const { data: creditPack } = await supabase
    .from("credit_packs")
    .select("*")
    .eq("client_id", clientId)
    .order("purchased_at", { ascending: true })
    .limit(10);

  const activePack = creditPack?.find((p) => p.total_credits - p.used_credits > 0);

  if (!activePack) {
    return NextResponse.json({ error: "No credits available" }, { status: 402 });
  }

  // Deduct credit and reveal lead in a transaction-like flow
  const [leadUpdate, creditUpdate, txInsert] = await Promise.all([
    supabase.from("leads").update({
      status: "revealed",
      revealed_at: new Date().toISOString(),
    }).eq("id", leadId),

    supabase.from("credit_packs").update({
      used_credits: activePack.used_credits + 1,
    }).eq("id", activePack.id),

    supabase.from("credit_transactions").insert({
      client_id: clientId,
      credit_pack_id: activePack.id,
      type: "debit",
      amount: 1,
      lead_id: leadId,
      description: `Revealed lead: ${lead.company_name}`,
    }),
  ]);

  if (leadUpdate.error || creditUpdate.error || txInsert.error) {
    return NextResponse.json({ error: "Failed to reveal lead" }, { status: 500 });
  }

  // Return full lead data
  const { data: revealedLead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  return NextResponse.json({ lead: revealedLead });
}
