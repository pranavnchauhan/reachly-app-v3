import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { leadId, clientId, disposition, dispositionNote, followUpDate, dealValue, leadRating } = await request.json();

  if (!leadId || !clientId || !disposition) {
    return NextResponse.json({ error: "leadId, clientId, and disposition required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify lead belongs to client
  const { data: lead } = await supabase
    .from("leads")
    .select("id, company_name, disposition, client_niches!inner(client_id)")
    .eq("id", leadId)
    .single();

  if (!lead || (lead.client_niches as unknown as { client_id: string }).client_id !== clientId) {
    return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
  }

  const oldDisposition = lead.disposition || "revealed";

  // Build update
  const update: Record<string, unknown> = { disposition };

  if (dispositionNote !== undefined) update.disposition_note = dispositionNote || null;
  if (followUpDate !== undefined) update.follow_up_date = followUpDate || null;
  if (dealValue !== undefined) update.deal_value = dealValue || null;
  if (leadRating !== undefined) update.lead_rating = leadRating || null;

  // Set timestamp fields
  if (disposition === "contacted" && oldDisposition !== "contacted") update.contacted_at = new Date().toISOString();
  if (disposition === "won" && oldDisposition !== "won") update.won_at = new Date().toISOString();
  if (disposition === "lost" && oldDisposition !== "lost") update.lost_at = new Date().toISOString();

  const { error } = await supabase.from("leads").update(update).eq("id", leadId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log status change as a note
  if (disposition !== oldDisposition) {
    await supabase.from("lead_notes").insert({
      lead_id: leadId,
      client_id: clientId,
      type: "status_change",
      content: `Status changed from ${oldDisposition} to ${disposition}${dispositionNote ? `: ${dispositionNote}` : ""}`,
    });
  }

  return NextResponse.json({ success: true });
}
