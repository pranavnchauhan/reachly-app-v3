import { requireAdmin } from "@/lib/auth-guard";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, disputeResolvedEmail } from "@/lib/email";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response;

  const { disputeId, action, adminNotes, leadId, clientId, companyId, companyName, clientName, clientEmail } = await request.json();

  if (!disputeId || !action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "disputeId and action (approve/reject) required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const status = action === "approve" ? "approved" : "rejected";

  // Update dispute
  const { error: disputeError } = await supabase
    .from("disputes")
    .update({
      status,
      admin_notes: adminNotes || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", disputeId);

  if (disputeError) {
    return NextResponse.json({ error: disputeError.message }, { status: 500 });
  }

  // If approved, refund 1 credit
  if (action === "approve" && clientId) {
    // Find an active credit pack to add the refund to
    const { data: packs } = await supabase
      .from("credit_packs")
      .select("id, total_credits, used_credits, expires_at")
      .or(companyId ? `client_id.eq.${clientId},company_id.eq.${companyId}` : `client_id.eq.${clientId}`)
      .order("purchased_at", { ascending: false })
      .limit(1);

    if (packs && packs.length > 0) {
      const pack = packs[0];

      // If pack has used credits, reduce used_credits (refund)
      if (pack.used_credits > 0) {
        await supabase
          .from("credit_packs")
          .update({ used_credits: pack.used_credits - 1 })
          .eq("id", pack.id);
      } else {
        // No used credits to reverse — add 1 to total instead
        await supabase
          .from("credit_packs")
          .update({ total_credits: pack.total_credits + 1 })
          .eq("id", pack.id);
      }

      // Log refund transaction
      await supabase.from("credit_transactions").insert({
        company_id: companyId || null,
        client_id: clientId,
        credit_pack_id: pack.id,
        type: "refund",
        amount: 1,
        lead_id: leadId || null,
        description: `Dispute approved: ${companyName || "lead"} — 1 credit refunded`,
      });
    }

    // Update lead status to refunded
    if (leadId) {
      await supabase.from("leads").update({ status: "refunded" }).eq("id", leadId);
    }
  }

  // Send notification email to client
  if (clientEmail && clientName) {
    const firstName = clientName.split(" ")[0];
    const email = disputeResolvedEmail(firstName, companyName || "lead", status as "approved" | "rejected", adminNotes || null);
    sendEmail({ to: clientEmail, toName: clientName, ...email }).catch(() => {});
  }

  return NextResponse.json({ success: true, status });
}
