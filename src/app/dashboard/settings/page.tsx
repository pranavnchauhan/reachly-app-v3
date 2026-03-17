export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { Target } from "lucide-react";

export default async function SettingsPage() {
  const user = await getUser();
  const supabase = await createClient();

  const { data: niches } = await supabase
    .from("client_niches")
    .select("*, niche_templates(name)")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Profile */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-4">Profile</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted">Name</span>
            <p className="font-medium">{user.full_name}</p>
          </div>
          <div>
            <span className="text-muted">Email</span>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <span className="text-muted">Company</span>
            <p className="font-medium">{user.company_name || "—"}</p>
          </div>
          <div>
            <span className="text-muted">Member since</span>
            <p className="font-medium">{new Date(user.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Active Niches */}
      <h2 className="text-lg font-semibold mb-3">My Niches</h2>
      {!niches?.length ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Target className="w-8 h-8 text-muted mx-auto mb-3" />
          <p className="text-muted">No niches assigned yet. Contact your admin to set up your targeting.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {niches.map((niche) => (
            <div key={niche.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{niche.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${niche.is_active ? "bg-success/10 text-success" : "bg-muted/10 text-muted"}`}>
                  {niche.is_active ? "Active" : "Paused"}
                </span>
              </div>
              <p className="text-sm text-muted">Template: {niche.niche_templates?.name ?? "—"}</p>
              <div className="flex gap-4 mt-2 text-xs text-muted">
                <span>{niche.geography?.length ?? 0} locations</span>
                <span>{niche.enabled_signals?.length ?? 0} signals active</span>
                <span>{niche.excluded_companies?.length ?? 0} exclusions</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
