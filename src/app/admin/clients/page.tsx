export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";

export default async function ClientsPage() {
  const supabase = createAdminClient();

  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });

  // Get user counts and niche counts per company
  const companyIds = (companies || []).map((c) => c.id);
  const { data: profiles } = companyIds.length
    ? await supabase.from("profiles").select("company_id").in("company_id", companyIds)
    : { data: [] };
  const { data: niches } = companyIds.length
    ? await supabase.from("client_niches").select("company_id").in("company_id", companyIds).eq("is_active", true)
    : { data: [] };

  const userCounts: Record<string, number> = {};
  const nicheCounts: Record<string, number> = {};
  (profiles || []).forEach((p) => { if (p.company_id) userCounts[p.company_id] = (userCounts[p.company_id] || 0) + 1; });
  (niches || []).forEach((n) => { if (n.company_id) nicheCounts[n.company_id] = (nicheCounts[n.company_id] || 0) + 1; });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted">{companies?.length || 0} companies</p>
        </div>
        <Link href="/admin/clients/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
          <Plus className="w-4 h-4" /> New Client
        </Link>
      </div>

      {!companies?.length ? (
        <div className="bg-card/80 border border-border/50 rounded-xl p-12 text-center">
          <Building2 className="w-10 h-10 text-muted mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">No clients yet</h2>
          <p className="text-sm text-muted mb-4">Create your first client to get started.</p>
          <Link href="/admin/clients/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
            <Plus className="w-4 h-4" /> Create Client
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => (
            <Link key={company.id} href={`/admin/clients/${company.id}`}
              className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all block">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">{company.company_name}</h3>
                {company.abn && (
                  <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full">ABN verified</span>
                )}
              </div>
              {company.business_names?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {company.business_names.slice(0, 2).map((bn: string, i: number) => (
                    <span key={i} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{bn}</span>
                  ))}
                  {company.business_names.length > 2 && (
                    <span className="text-[10px] text-muted">+{company.business_names.length - 2}</span>
                  )}
                </div>
              )}
              <div className="space-y-1 text-xs text-muted">
                {company.industry && <p>{company.industry}</p>}
                {company.city && <p>{[company.city, company.state].filter(Boolean).join(", ")}</p>}
                {company.abn && <p className="font-mono">ABN: {company.abn}</p>}
              </div>
              <div className="flex gap-4 mt-3 pt-3 border-t border-border/30 text-xs text-muted">
                <span>{userCounts[company.id] || 0} users</span>
                <span>{nicheCounts[company.id] || 0} niches</span>
                <span>Since {new Date(company.created_at).toLocaleDateString("en-AU")}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
