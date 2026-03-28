import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, newLeadsEmail } from "@/lib/email";

// POST: Validate, assign to client, or reject a lead — with audit trail
export async function POST(request: Request) {
  const body = await request.json();
  const { leadId, action, clientNicheId, contactOverride, rejectionReason } = body as {
    leadId: string;
    action: "validate" | "publish" | "reject";
    clientNicheId?: string; // required for publish
    contactOverride?: {
      contact_name: string;
      contact_title: string;
      contact_email: string | null;
      contact_phone: string | null;
      contact_linkedin: string | null;
      contact_summary: string | null;
    };
    rejectionReason?: string;
  };

  if (!leadId || !action) {
    return NextResponse.json({ error: "leadId and action required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get current lead state (for audit trail)
  const { data: currentLead, error: fetchErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (fetchErr || !currentLead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Build audit trail
  const changes: { field: string; from: unknown; to: unknown }[] = [];

  if (action === "reject") {
    // Soft-delete: set status to rejected (or delete)
    const { error } = await supabase.from("leads").update({
      status: "discovered", // keep in DB but mark validation_changes with rejection
      validation_changes: {
        action: "rejected",
        rejected_at: new Date().toISOString(),
        reason: rejectionReason || "Not suitable",
      },
      archived_at: new Date().toISOString(),
    }).eq("id", leadId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, action: "rejected" });
  }

  const updateData: Record<string, unknown> = {};

  if (action === "validate") {
    updateData.status = "validated";
    updateData.validated_at = new Date().toISOString();
  }

  if (action === "publish") {
    if (!clientNicheId) {
      return NextResponse.json({ error: "clientNicheId required for publish" }, { status: 400 });
    }
    updateData.status = "published";
    updateData.published_at = new Date().toISOString();
    updateData.client_niche_id = clientNicheId;

    // Track client assignment change
    if (currentLead.client_niche_id !== clientNicheId) {
      changes.push({ field: "client_niche_id", from: currentLead.client_niche_id, to: clientNicheId });
    }
  }

  // Apply contact override if provided (from Verify Contact)
  if (contactOverride) {
    const contactFields = ["contact_name", "contact_title", "contact_email", "contact_phone", "contact_linkedin", "contact_summary"] as const;
    for (const field of contactFields) {
      if (contactOverride[field] !== undefined && contactOverride[field] !== currentLead[field]) {
        changes.push({ field, from: currentLead[field], to: contactOverride[field] });
        updateData[field] = contactOverride[field];
      }
    }
  }

  // Save validation changes
  if (changes.length > 0 || action === "validate" || action === "publish") {
    updateData.validation_changes = {
      validated_at: new Date().toISOString(),
      action,
      changes,
    };
  }

  const { error } = await supabase.from("leads").update(updateData).eq("id", leadId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send notification on publish
  if (action === "publish" && clientNicheId) {
    const { data: niche } = await supabase
      .from("client_niches")
      .select("client_id")
      .eq("id", clientNicheId)
      .single();

    if (niche) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", niche.client_id)
        .single();

      if (profile) {
        const firstName = profile.full_name.split(" ")[0];
        const email = newLeadsEmail(firstName, 1);
        sendEmail({ to: profile.email, toName: profile.full_name, ...email }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ success: true, action, changes: changes.length });
}
