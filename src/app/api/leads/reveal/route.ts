import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = createAdminClient();
  const { leadId, clientId } = await request.json();

  // Verify lead is published and belongs to client's niche
  const { data: lead } = await supabase
    .from("leads")
    .select("*, client_niches!inner(client_id, company_id)")
    .eq("id", leadId)
    .eq("status", "published")
    .single();

  if (!lead || lead.client_niches.client_id !== clientId) {
    return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
  }

  // Get user's company
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", clientId)
    .single();

  const companyId = profile?.company_id;

  // Find active credit pack — check company-level first, then user-level (FIFO order)
  const packs: { id: string; total_credits: number; used_credits: number; company_id: string | null }[] = [];

  if (companyId) {
    const { data: companyPacks } = await supabase
      .from("credit_packs")
      .select("id, total_credits, used_credits, company_id")
      .eq("company_id", companyId)
      .order("purchased_at", { ascending: true });
    if (companyPacks) packs.push(...companyPacks);
  }

  const { data: userPacks } = await supabase
    .from("credit_packs")
    .select("id, total_credits, used_credits, company_id")
    .eq("client_id", clientId)
    .is("company_id", null)
    .order("purchased_at", { ascending: true });
  if (userPacks) packs.push(...userPacks);

  const activePack = packs.find((p) => p.total_credits - p.used_credits > 0);

  if (!activePack) {
    return NextResponse.json({ error: "No credits available" }, { status: 402 });
  }

  // Deduct credit and reveal lead
  const [leadUpdate, creditUpdate, txInsert] = await Promise.all([
    supabase.from("leads").update({
      status: "revealed",
      revealed_at: new Date().toISOString(),
    }).eq("id", leadId),

    supabase.from("credit_packs").update({
      used_credits: activePack.used_credits + 1,
    }).eq("id", activePack.id),

    supabase.from("credit_transactions").insert({
      company_id: activePack.company_id || companyId || null,
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
