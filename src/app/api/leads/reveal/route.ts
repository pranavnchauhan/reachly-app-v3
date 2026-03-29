import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth-guard";
import { sendEmail, leadRevealedEmail, creditLowEmail } from "@/lib/email";

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  const supabase = createAdminClient();
  const { leadId } = await request.json();
  const clientId = auth.userId; // Use verified session user, not request body

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
  const now = new Date().toISOString();

  // Find active credit pack — FIFO, skip expired packs
  const packs: { id: string; total_credits: number; used_credits: number; company_id: string | null; expires_at: string | null }[] = [];

  if (companyId) {
    const { data: companyPacks } = await supabase
      .from("credit_packs")
      .select("id, total_credits, used_credits, company_id, expires_at")
      .eq("company_id", companyId)
      .order("purchased_at", { ascending: true });
    if (companyPacks) packs.push(...companyPacks);
  }

  const { data: userPacks } = await supabase
    .from("credit_packs")
    .select("id, total_credits, used_credits, company_id, expires_at")
    .eq("client_id", clientId)
    .is("company_id", null)
    .order("purchased_at", { ascending: true });
  if (userPacks) packs.push(...userPacks);

  // Find first pack with remaining credits that hasn't expired
  const activePack = packs.find((p) => {
    const hasCredits = p.total_credits - p.used_credits > 0;
    const isValid = !p.expires_at || new Date(p.expires_at) > new Date(now);
    return hasCredits && isValid;
  });

  if (!activePack) {
    // Check if they had credits but all expired
    const hasExpiredCredits = packs.some((p) => {
      const hasCredits = p.total_credits - p.used_credits > 0;
      const isExpired = p.expires_at && new Date(p.expires_at) <= new Date(now);
      return hasCredits && isExpired;
    });

    if (hasExpiredCredits) {
      return NextResponse.json({
        error: "credits_expired",
        message: "Your credits have expired. Purchase a new pack to continue revealing leads — any remaining balance will be rolled over.",
      }, { status: 402 });
    }

    return NextResponse.json({
      error: "no_credits",
      message: "No credits available. Purchase a credit pack to start revealing leads.",
    }, { status: 402 });
  }

  // Deduct credit atomically — use conditional update to prevent double-spend
  // The WHERE clause ensures used_credits hasn't changed since we read it
  const { data: creditResult, error: creditError } = await supabase
    .from("credit_packs")
    .update({ used_credits: activePack.used_credits + 1 })
    .eq("id", activePack.id)
    .eq("used_credits", activePack.used_credits) // Optimistic lock
    .select("id")
    .single();

  if (creditError || !creditResult) {
    // Another request already used this credit — retry or fail
    return NextResponse.json({ error: "Credit already used. Please try again." }, { status: 409 });
  }

  // Credit locked — now reveal lead and log transaction
  const [leadUpdate, txInsert] = await Promise.all([
    supabase.from("leads").update({
      status: "revealed",
      revealed_at: new Date().toISOString(),
    }).eq("id", leadId),

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

  if (leadUpdate.error || txInsert.error) {
    return NextResponse.json({ error: "Failed to reveal lead" }, { status: 500 });
  }

  // Return full lead data
  const { data: revealedLead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  // ─── Send notification emails (fire and forget) ────────────────────
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", clientId)
    .single();

  if (clientProfile && revealedLead) {
    const firstName = clientProfile.full_name.split(" ")[0];

    // 1. Reveal confirmation with contact details
    const revealEmail = leadRevealedEmail(
      firstName,
      revealedLead.company_name,
      revealedLead.contact_name,
      revealedLead.contact_title,
      revealedLead.contact_email,
      revealedLead.contact_phone,
      revealedLead.contact_linkedin,
    );
    sendEmail({ to: clientProfile.email, toName: clientProfile.full_name, ...revealEmail }).catch(() => {});

    // 2. Low credit warning (check remaining after this deduction)
    const remainingCredits = activePack.total_credits - activePack.used_credits - 1;
    // Also count other active packs
    const otherRemaining = packs
      .filter((p) => p.id !== activePack.id && (!p.expires_at || new Date(p.expires_at) > new Date()) && p.total_credits - p.used_credits > 0)
      .reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0);
    const totalRemaining = remainingCredits + otherRemaining;

    if (totalRemaining <= 2 && totalRemaining >= 0) {
      const lowEmail = creditLowEmail(firstName, totalRemaining);
      sendEmail({ to: clientProfile.email, toName: clientProfile.full_name, ...lowEmail }).catch(() => {});
    }
  }

  return NextResponse.json({ lead: revealedLead });
}
