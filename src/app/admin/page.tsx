export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { Target, Users, Zap, AlertTriangle } from "lucide-react";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { count: templateCount },
    { count: clientCount },
    { count: pendingLeads },
    { count: pendingDisputes },
  ] = await Promise.all([
    supabase.from("niche_templates").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "client"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "discovered"),
    supabase.from("disputes").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const stats = [
    { label: "Niche Templates", value: templateCount ?? 0, icon: Target, color: "text-primary" },
    { label: "Clients", value: clientCount ?? 0, icon: Users, color: "text-accent" },
    { label: "Leads to Validate", value: pendingLeads ?? 0, icon: Zap, color: "text-warning" },
    { label: "Pending Disputes", value: pendingDisputes ?? 0, icon: AlertTriangle, color: "text-danger" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <span className="text-sm text-muted">{stat.label}</span>
            </div>
            <p className="text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <p className="text-muted text-sm">Pipeline activity and lead validation history will appear here.</p>
      </div>
    </div>
  );
}
