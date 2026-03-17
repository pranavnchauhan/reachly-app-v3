export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { Zap, CreditCard, Target, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function ClientDashboard() {
  const user = await getUser();
  const supabase = await createClient();

  const [
    { count: availableLeads },
    { data: creditPacks },
    { count: activeNiches },
    { count: pendingDisputes },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("status", "published")
      .in("client_niche_id",
        (await supabase.from("client_niches").select("id").eq("client_id", user.id)).data?.map(n => n.id) ?? []
      ),
    supabase.from("credit_packs").select("total_credits, used_credits").eq("client_id", user.id),
    supabase.from("client_niches").select("*", { count: "exact", head: true }).eq("client_id", user.id).eq("is_active", true),
    supabase.from("disputes").select("*", { count: "exact", head: true }).eq("client_id", user.id).eq("status", "pending"),
  ]);

  const totalCredits = creditPacks?.reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0) ?? 0;

  const stats = [
    { label: "Leads Available", value: availableLeads ?? 0, icon: Zap, color: "text-primary", href: "/dashboard/leads" },
    { label: "Credits Remaining", value: totalCredits, icon: CreditCard, color: "text-accent", href: "/dashboard/credits" },
    { label: "Active Niches", value: activeNiches ?? 0, icon: Target, color: "text-success", href: "/dashboard/settings" },
    { label: "Open Disputes", value: pendingDisputes ?? 0, icon: AlertTriangle, color: "text-warning", href: "/dashboard/disputes" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Welcome back, {user.full_name.split(" ")[0]}</h1>
      <p className="text-muted text-sm mb-6">Here&apos;s your lead generation overview.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}
            className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <span className="text-sm text-muted">{stat.label}</span>
            </div>
            <p className="text-3xl font-bold">{stat.value}</p>
          </Link>
        ))}
      </div>

      {(availableLeads ?? 0) > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">New leads are ready!</h2>
          <p className="text-sm text-muted mb-4">
            You have {availableLeads} leads waiting. Each revealed lead costs 1 credit.
          </p>
          <Link href="/dashboard/leads"
            className="inline-flex px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
            View Leads
          </Link>
        </div>
      )}
    </div>
  );
}
