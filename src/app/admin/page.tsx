
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Users, Target, Zap, ClipboardList, CheckCircle2, Clock, Eye,
  CreditCard, BarChart3, ArrowRight, Plus, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { PipelineTrigger } from "@/components/admin/pipeline-trigger";

export default async function AdminDashboard() {
  const supabase = createAdminClient();

  const [
    { count: totalClients },
    { count: activeNiches },
    { count: totalNiches },
    { count: discoveredLeads },
    { count: validatedLeads },
    { count: publishedLeads },
    { count: revealedLeads },
    { count: totalLeads },
    { data: activeClientNiches },
    { data: recentLeads },
    { data: clients },
    { data: pendingDisputes },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "client"),
    supabase.from("client_niches").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("niche_templates").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "discovered"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "validated"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "revealed"),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("client_niches").select("id, name").eq("is_active", true),
    supabase.from("leads").select("id, company_name, contact_name, contact_title, status, contact_email, discovered_at, signals_matched").order("created_at", { ascending: false }).limit(5),
    supabase.from("profiles").select("id, full_name, company_name, email, created_at").eq("role", "client").order("created_at", { ascending: false }).limit(5),
    supabase.from("disputes").select("id, reason, status, created_at, leads(company_name, contact_name), profiles!disputes_client_id_fkey(full_name)").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
  ]);

  const approvalRate = (totalLeads ?? 0) > 0 ? Math.round(((validatedLeads ?? 0) + (publishedLeads ?? 0) + (revealedLeads ?? 0)) / (totalLeads ?? 1) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Command Centre</h1>
          <p className="text-sm text-muted">Pipeline health, clients & lead generation</p>
        </div>
      </div>

      {/* Pending Disputes Banner */}
      {pendingDisputes && pendingDisputes.length > 0 && (
        <Link href="/admin/disputes"
          className="flex items-start gap-4 bg-warning/5 border border-warning/30 rounded-xl p-5 hover:bg-warning/10 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">{pendingDisputes.length} dispute{pendingDisputes.length > 1 ? "s" : ""} pending review</p>
            <div className="mt-1 space-y-0.5">
              {pendingDisputes.slice(0, 3).map((d) => (
                <p key={d.id} className="text-xs text-muted">
                  {(d.leads as unknown as { company_name: string })?.company_name} — filed by {(d.profiles as unknown as { full_name: string })?.full_name}
                </p>
              ))}
              {pendingDisputes.length > 3 && <p className="text-xs text-muted">+{pendingDisputes.length - 3} more</p>}
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-warning flex-shrink-0 mt-1" />
        </Link>
      )}

      {/* Quick Nav */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Clients", value: totalClients ?? 0, icon: Users, href: "/admin/clients" },
          { label: "Niche Templates", value: totalNiches ?? 0, icon: Target, href: "/admin/niches" },
          { label: "To Validate", value: discoveredLeads ?? 0, icon: ClipboardList, href: "/admin/leads" },
          { label: "Active Niches", value: activeNiches ?? 0, icon: Zap, href: "/admin/niches" },
          { label: "Published", value: publishedLeads ?? 0, icon: Eye, href: "/admin/leads" },
        ].map((item) => (
          <Link key={item.label} href={item.href}
            className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">{item.label}</p>
                <p className="text-2xl font-bold mt-0.5">{item.value}</p>
              </div>
              <item.icon className="w-6 h-6 text-primary/30 group-hover:text-primary transition-colors" />
            </div>
          </Link>
        ))}
      </div>

      {/* Lead Pipeline Health */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Lead Pipeline</h2>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6 mb-4">
          {[
            { label: "Total", value: totalLeads ?? 0, icon: ClipboardList, color: "text-foreground" },
            { label: "Discovered", value: discoveredLeads ?? 0, icon: Clock, color: "text-warning" },
            { label: "Validated", value: validatedLeads ?? 0, icon: CheckCircle2, color: "text-primary" },
            { label: "Published", value: publishedLeads ?? 0, icon: Eye, color: "text-accent" },
            { label: "Revealed", value: revealedLeads ?? 0, icon: Zap, color: "text-success" },
            { label: "Approval", value: `${approvalRate}%`, icon: BarChart3, color: "text-primary" },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-lg bg-background/50 border border-border/30 text-center">
              <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-[11px] text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Link href="/admin/leads"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-background transition-colors">
            Review Leads <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Run Pipeline */}
        <PipelineTrigger niches={activeClientNiches ?? []} />

        {/* Create Client */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
          <div className="space-y-2">
            <Link href="/admin/clients/new"
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors w-full justify-center">
              <Plus className="w-4 h-4" /> Create Client
            </Link>
            <Link href="/admin/niches/new"
              className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background transition-colors w-full justify-center">
              <Target className="w-4 h-4" /> New Niche Template
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Leads + Clients */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Leads */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Leads</h2>
            <Link href="/admin/leads" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {!recentLeads?.length ? (
            <p className="text-sm text-muted">No leads yet. Run the pipeline to discover leads.</p>
          ) : (
            <div className="space-y-2">
              {recentLeads.map((lead) => {
                const hasSourceUrl = (lead.signals_matched as { source_url?: string }[])?.[0]?.source_url;
                return (
                  <div key={lead.id} className="flex items-center justify-between p-2.5 bg-background/50 border border-border/30 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{lead.company_name}</span>
                        {hasSourceUrl ? (
                          <span className="text-[9px] bg-red-500 text-white px-1 py-0.5 rounded shrink-0">HOT</span>
                        ) : (
                          <span className="text-[9px] bg-blue-500 text-white px-1 py-0.5 rounded shrink-0">COLD</span>
                        )}
                      </div>
                      <p className="text-xs text-muted truncate">{lead.contact_name} — {lead.contact_title}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${
                      lead.status === "discovered" ? "bg-warning/10 text-warning" :
                      lead.status === "validated" ? "bg-primary/10 text-primary" :
                      "bg-success/10 text-success"
                    }`}>{lead.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Clients */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Clients</h2>
            <Link href="/admin/clients" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {!clients?.length ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted mb-3">No clients yet.</p>
              <Link href="/admin/clients/new" className="text-sm text-primary hover:underline">Create your first client</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <Link key={client.id} href={`/admin/clients/${client.id}`}
                  className="flex items-center justify-between p-2.5 bg-background/50 border border-border/30 rounded-lg hover:border-primary/30 transition-colors block">
                  <div>
                    <p className="text-sm font-medium">{client.full_name}</p>
                    <p className="text-xs text-muted">{client.company_name || client.email}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
