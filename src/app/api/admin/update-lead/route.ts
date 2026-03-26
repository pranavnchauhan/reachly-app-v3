import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, newLeadsEmail, disputeResolvedEmail } from "@/lib/email";

export async function POST(request: Request) {
  const { leadId, status, adminNotes } = await request.json();

  if (!leadId || !status) {
    return NextResponse.json({ error: "leadId and status required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const updateData: Record<string, string> = { status };
  if (status === "validated") updateData.validated_at = new Date().toISOString();
  if (status === "published") updateData.published_at = new Date().toISOString();

  const { error } = await supabase.from("leads").update(updateData).eq("id", leadId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ─── Send notifications ────────────────────────────────────────────

  // Get lead + client info for notifications
  const { data: lead } = await supabase
    .from("leads")
    .select("company_name, client_niches!inner(client_id)")
    .eq("id", leadId)
    .single();

  if (lead) {
    const clientId = (lead.client_niches as unknown as { client_id: string }).client_id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", clientId)
      .single();

    if (profile) {
      const firstName = profile.full_name.split(" ")[0];

      // New lead published → notify client
      if (status === "published") {
        // Count total unpublished leads for this client to batch the notification
        const { count } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("status", "published")
          .eq("client_niche_id", (lead.client_niches as unknown as { id: string }).id || "");

        // Fire and forget — don't block the response
        const email = newLeadsEmail(firstName, count ?? 1);
        sendEmail({ to: profile.email, toName: profile.full_name, ...email }).catch(() => {});
      }

      // Dispute resolved → notify client
      if (status === "approved" || status === "rejected") {
        const email = disputeResolvedEmail(firstName, lead.company_name, status, adminNotes || null);
        sendEmail({ to: profile.email, toName: profile.full_name, ...email }).catch(() => {});

        // If approved, refund credit
        if (status === "approved") {
          // Update dispute record
          await supabase
            .from("disputes")
            .update({ status: "approved", admin_notes: adminNotes || null, resolved_at: new Date().toISOString() })
            .eq("lead_id", leadId);
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
