import { requireAdmin } from "@/lib/auth-guard";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, newLeadsEmail } from "@/lib/email";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response;

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
    .select("company_name, client_niche_id, client_niches!inner(client_id)")
    .eq("id", leadId)
    .single();

  if (lead && status === "published") {
    const clientId = (lead.client_niches as unknown as { client_id: string }).client_id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", clientId)
      .single();

    if (profile) {
      const firstName = profile.full_name.split(" ")[0];

      // Count published leads for this client's niche
      const { count } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("status", "published")
        .eq("client_niche_id", lead.client_niche_id);

      const email = newLeadsEmail(firstName, count ?? 1);
      sendEmail({ to: profile.email, toName: profile.full_name, ...email }).catch(() => {});
    }
  }

  return NextResponse.json({ success: true });
}
