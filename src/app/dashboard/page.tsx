export const dynamic = "force-dynamic";

import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Zap, CreditCard, Target, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function ClientDashboard() {
  const user = await getUser();
  const supabase = createAdminClient();

  // Get client's niches
  const { data: niches } = await supabase
    .from("client_niches")
    .select("id")
    .eq("client_id", user.id);

  const nicheIds = niches?.map((n) => n.id) ?? [];

  const [
    { count: availableLeads },
    { count: revealedLeads },
    { data: creditPacks },
    { count: activeNiches },
  ] = await Promise.all([
    nicheIds.length
      ? supabase.from("leads").select("*", { count: "exact", head: true })
          .eq("status", "published")
          .in("client_niche_id", nicheIds)
      : { count: 0 },
    nicheIds.length
      ? supabase.from("leads").select("*", { count: "exact", head: true })
          .eq("status", "revealed")
          .in("client_niche_id", nicheIds)
      : { count: 0 },
    supabase.from("credit_packs").select("total_credits, used_credits").eq("client_id", user.id),
    supabase.from("client_niches").select("*", { count: "exact", head: true }).eq("client_id", user.id).eq("is_active", true),
  ]);

  const totalCredits = creditPacks?.reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0) ?? 0;

  const stats = [
    { label: "New Leads", value: availableLeads ?? 0, icon: Zap, color: "text-primary", href: "/dashboard/leads" },
    { label: "Revealed Leads", value: revealedLeads ?? 0, icon: Target, color: "text-success", href: "/dashboard/leads" },
    { label: "Credits", value: totalCredits, icon: CreditCard, color: "text-accent", href: "/dashboard/credits" },
    { label: "Active Niches", value: activeNiches ?? 0, icon: AlertTriangle, color: "text-warning", href: "/dashboard/settings" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Welcome back, {user.full_name.split(" ")[0]}</h1>
      <p className="text-muted text-sm mb-6">Here&apos;s your lead generation overview.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}
            className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <span className="text-sm text-muted">{stat.label}</span>
            </div>
            <p className="text-3xl font-bold">{stat.value}</p>
          </Link>
        ))}
      </div>

      {(availableLeads ?? 0) > 0 && (
        <div className="bg-primary/5 backdrop-blur-sm border border-primary/20 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">New leads are ready!</h2>
          <p className="text-sm text-muted mb-4">
            You have {availableLeads} leads waiting to be revealed. Each reveal costs 1 credit.
          </p>
          <Link href="/dashboard/leads"
            className="inline-flex px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
            View Leads
          </Link>
        </div>
      )}

      {(availableLeads ?? 0) === 0 && (revealedLeads ?? 0) === 0 && (
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-8 text-center">
          <Zap className="w-10 h-10 text-muted mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">No leads yet</h2>
          <p className="text-sm text-muted">Your leads will appear here once they&apos;re ready. We&apos;re working on finding the best matches for you.</p>
        </div>
      )}
    </div>
  );
}
