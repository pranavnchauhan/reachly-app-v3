
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Building2, Users, Target, CreditCard, Mail, Phone, MapPin, Globe,
  Plus,
} from "lucide-react";
import { AssignNiche } from "@/components/admin/assign-niche";
import { AddCredits } from "@/components/admin/add-credits";
import { ClientActions } from "@/components/admin/client-actions";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Try companies table first (new model)
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();

  if (!company) {
    // Fallback: try profiles (old model)
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).single();
    if (!profile) notFound();
    // Redirect to user detail page for old-model clients
    notFound();
  }

  // Get users in this company
  const { data: companyUsers } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, account_status, created_at")
    .eq("company_id", id)
    .order("created_at");

  // Get niches for this company
  const { data: companyNiches } = await supabase
    .from("client_niches")
    .select("*, niche_templates(name, signals)")
    .eq("company_id", id)
    .order("created_at", { ascending: false });

  // Also get niches assigned to users in this company (backward compat)
  const userIds = (companyUsers || []).map((u) => u.id);
  const { data: userNiches } = userIds.length
    ? await supabase
        .from("client_niches")
        .select("*, niche_templates(name, signals)")
        .in("client_id", userIds)
        .is("company_id", null)
    : { data: [] };

  const allNiches = [...(companyNiches || []), ...(userNiches || [])];

  // Get available templates
  const { data: templates } = await supabase
    .from("niche_templates")
    .select("id, name, signals, industries")
    .eq("is_active", true);

  // Get lead counts
  const nicheIds = allNiches.map((n) => n.id);
  const { count: totalLeads } = nicheIds.length
    ? await supabase.from("leads").select("*", { count: "exact", head: true }).in("client_niche_id", nicheIds)
    : { count: 0 };

  // Get credit packs — company-level + user-level
  const { data: companyPacks } = await supabase
    .from("credit_packs")
    .select("id, total_credits, used_credits, purchased_at")
    .eq("company_id", id)
    .order("purchased_at", { ascending: false });

  const { data: userPacks } = userIds.length
    ? await supabase
        .from("credit_packs")
        .select("id, total_credits, used_credits, purchased_at")
        .in("client_id", userIds)
        .is("company_id", null)
    : { data: [] };

  const allPacks = [...(companyPacks || []), ...(userPacks || [])];
  const totalCredits = allPacks.reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0);

  // Get recent transactions
  const { data: companyTx } = await supabase
    .from("credit_transactions")
    .select("id, type, amount, description, created_at")
    .eq("company_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: userTx } = userIds.length
    ? await supabase
        .from("credit_transactions")
        .select("id, type, amount, description, created_at")
        .in("client_id", userIds)
        .is("company_id", null)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] };

  const allTransactions = [...(companyTx || []), ...(userTx || [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  return (
    <div className="max-w-4xl">
      <Link href="/admin/clients" className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Clients
      </Link>

      {/* Company Header */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{company.company_name}</h1>
            {company.business_names?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {company.business_names.map((bn: string, i: number) => (
                  <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">t/a {bn}</span>
                ))}
              </div>
            )}
          </div>
          <ClientActions companyId={id} companyName={company.company_name} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-border/30">
          <div className="flex items-center gap-2 text-sm text-muted">
            {company.abn && <><Globe className="w-3.5 h-3.5" /> ABN: <span className="font-mono">{company.abn}</span></>}
          </div>
          {company.industry && <p className="text-sm text-muted flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> {company.industry}</p>}
          {company.email && <p className="text-sm text-muted flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {company.email}</p>}
          {company.phone && <p className="text-sm text-muted flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {company.phone}</p>}
          {(company.city || company.state) && <p className="text-sm text-muted flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {[company.address, company.city, company.state, company.postcode].filter(Boolean).join(", ")}</p>}
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-border/30">
          <div>
            <p className="text-sm text-muted">Users</p>
            <p className="text-2xl font-bold">{companyUsers?.length ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Total Leads</p>
            <p className="text-2xl font-bold">{totalLeads ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Credits</p>
            <p className="text-2xl font-bold">{totalCredits}</p>
          </div>
        </div>

        {company.notes && (
          <div className="mt-4 pt-4 border-t border-border/30">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-muted">{company.notes}</p>
          </div>
        )}
      </div>

      {/* Users */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Users ({companyUsers?.length ?? 0})</h2>
          </div>
          <Link href={`/admin/users/new?company=${id}`}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-hover transition-colors">
            <Plus className="w-3 h-3" /> Add User
          </Link>
        </div>
        {!companyUsers?.length ? (
          <p className="text-sm text-muted">No users yet. Create a user for this client.</p>
        ) : (
          <div className="space-y-2">
            {companyUsers.map((user) => (
              <Link key={user.id} href={`/admin/users`}
                className="flex items-center justify-between p-3 bg-background/50 border border-border/30 rounded-lg hover:border-primary/30 transition-colors block">
                <div>
                  <p className="text-sm font-medium">{user.full_name}</p>
                  <p className="text-xs text-muted">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    user.account_status === "active" ? "bg-success/10 text-success" :
                    user.account_status === "paused" ? "bg-warning/10 text-warning" :
                    "bg-danger/10 text-danger"
                  }`}>{user.account_status}</span>
                  <span className="text-[10px] bg-muted/10 text-muted px-1.5 py-0.5 rounded-full">{user.role}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Niches */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Niches ({allNiches.length})</h2>
        </div>
        <AssignNiche
          clientId={userIds[0] || ""}
          companyId={id}
          templates={templates ?? []}
          existingNiches={allNiches}
        />
      </div>

      {/* Credits */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Credits</h2>
        </div>
        <AddCredits
          companyId={id}
          currentBalance={totalCredits}
          packs={allPacks}
          transactions={allTransactions}
        />
      </div>
    </div>
  );
}
