import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET: Get client recommendations for assigning a lead
// ?templateId=xxx — which master niche to find matching clients for
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get("templateId");

  if (!templateId) {
    return NextResponse.json({ error: "templateId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Find all active client niches subscribed to this master template
  const { data: clientNiches } = await supabase
    .from("client_niches")
    .select("id, name, client_id, company_id, profiles(full_name, email), companies(company_name)")
    .eq("template_id", templateId)
    .eq("is_active", true)
    .not("client_id", "is", null);

  if (!clientNiches?.length) {
    return NextResponse.json({ recommendations: [] });
  }

  // For each client niche, get assigned lead count + available credits
  const recommendations = await Promise.all(
    clientNiches.map(async (cn) => {
      const profile = cn.profiles as unknown as { full_name: string; email: string } | null;
      const company = cn.companies as unknown as { company_name: string } | null;

      // Count leads already assigned to this client niche
      const { count: assignedLeads } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("client_niche_id", cn.id)
        .in("status", ["published", "revealed"]);

      // Count available credits for this client (company-level + personal)
      const now = new Date().toISOString();
      let creditQuery = supabase
        .from("credit_packs")
        .select("total_credits, used_credits");

      // Check both company_id and client_id
      if (cn.company_id) {
        creditQuery = creditQuery.or(`company_id.eq.${cn.company_id},client_id.eq.${cn.client_id}`);
      } else {
        creditQuery = creditQuery.eq("client_id", cn.client_id);
      }

      const { data: packs } = await creditQuery.or(`expires_at.is.null,expires_at.gt.${now}`);
      const availableCredits = (packs || []).reduce(
        (sum, p) => sum + (p.total_credits - p.used_credits), 0
      );

      return {
        clientNicheId: cn.id,
        nicheName: cn.name,
        clientId: cn.client_id,
        clientName: profile?.full_name || "Unknown",
        companyName: company?.company_name || profile?.full_name || "Unknown",
        assignedLeads: assignedLeads || 0,
        availableCredits,
      };
    })
  );

  // Sort: fewest assigned leads first, then by available credits descending
  recommendations.sort((a, b) => {
    if (a.assignedLeads !== b.assignedLeads) return a.assignedLeads - b.assignedLeads;
    return b.availableCredits - a.availableCredits;
  });

  // Mark recommendation
  const recommended = recommendations.map((r, i) => ({
    ...r,
    recommended: i === 0 && r.availableCredits > 0,
    noCredits: r.availableCredits <= 0,
  }));

  return NextResponse.json({ recommendations: recommended });
}
