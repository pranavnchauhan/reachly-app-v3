import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET — list all orphaned data
export async function GET() {
  const supabase = createAdminClient();

  // Orphaned niches: client_id is null
  const { data: orphanedNiches } = await supabase
    .from("client_niches")
    .select("id, name, template_id, company_id, is_active, created_at, archived_at, archive_expires_at, niche_templates(name)")
    .is("client_id", null)
    .order("created_at", { ascending: false });

  // Get lead counts per orphaned niche
  const nicheIds = (orphanedNiches || []).map((n) => n.id);
  let leadCounts: Record<string, number> = {};
  if (nicheIds.length > 0) {
    const { data: leads } = await supabase
      .from("leads")
      .select("client_niche_id")
      .in("client_niche_id", nicheIds);

    leadCounts = (leads || []).reduce((acc, l) => {
      acc[l.client_niche_id] = (acc[l.client_niche_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  // Orphaned credit packs: client_id is null
  const { data: orphanedCredits } = await supabase
    .from("credit_packs")
    .select("id, total_credits, used_credits, purchased_at")
    .is("client_id", null);

  // Get companies for reassignment dropdown
  const { data: companies } = await supabase
    .from("companies")
    .select("id, company_name")
    .order("company_name");

  // Get users for reassignment
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, company_name, company_id, role")
    .eq("role", "client")
    .order("full_name");

  const enrichedNiches = (orphanedNiches || []).map((n) => ({
    ...n,
    lead_count: leadCounts[n.id] || 0,
    template_name: (n.niche_templates as unknown as { name: string } | null)?.name || "Unknown",
    days_until_purge: n.archive_expires_at
      ? Math.max(0, Math.ceil((new Date(n.archive_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null,
    is_expired: n.archive_expires_at ? new Date(n.archive_expires_at) <= new Date() : false,
  }));

  return NextResponse.json({
    niches: enrichedNiches,
    credits: orphanedCredits || [],
    companies: companies || [],
    users: users || [],
    summary: {
      total_niches: enrichedNiches.length,
      total_leads: Object.values(leadCounts).reduce((s, c) => s + c, 0),
      total_credits: (orphanedCredits || []).reduce((s, p) => s + (p.total_credits - p.used_credits), 0),
      archived: enrichedNiches.filter((n) => n.archived_at).length,
      expired: enrichedNiches.filter((n) => n.is_expired).length,
    },
  });
}

// POST — reassign, archive, or purge orphaned data
export async function POST(request: Request) {
  const { action, nicheId, nicheIds, userId, companyId } = await request.json();
  const supabase = createAdminClient();

  switch (action) {
    case "reassign": {
      if (!nicheId || !userId) {
        return NextResponse.json({ error: "Niche and user required" }, { status: 400 });
      }

      // Get user's company_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .single();

      await supabase.from("client_niches").update({
        client_id: userId,
        company_id: profile?.company_id || companyId || null,
        is_active: true,
        archived_at: null,
        archive_expires_at: null,
      }).eq("id", nicheId);

      return NextResponse.json({ success: true });
    }

    case "archive": {
      const ids = nicheIds || [nicheId];
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      await supabase.from("client_niches").update({
        archived_at: new Date().toISOString(),
        archive_expires_at: expiresAt.toISOString(),
      }).in("id", ids);

      return NextResponse.json({ success: true, expires_at: expiresAt.toISOString() });
    }

    case "purge": {
      const ids = nicheIds || [nicheId];

      // Delete leads first
      await supabase.from("leads").delete().in("client_niche_id", ids);
      await supabase.from("signal_requests").delete().in("client_niche_id", ids);

      // Delete niches
      await supabase.from("client_niches").delete().in("id", ids);

      return NextResponse.json({ success: true, purged: ids.length });
    }

    case "purge_credits": {
      await supabase.from("credit_transactions").delete().is("client_id", null);
      await supabase.from("credit_packs").delete().is("client_id", null);
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
