export const dynamic = "force-dynamic";

import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { User, Mail, Building2, Calendar, Target, MapPin, Radio, Ban, Shield, CreditCard, Clock } from "lucide-react";
import Link from "next/link";

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default async function SettingsPage() {
  const user = await getUser();
  const supabase = createAdminClient();

  // Get company info
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  let companyName = user.company_name || null;
  if (profile?.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", profile.company_id)
      .single();
    if (company?.name) companyName = company.name;
  }

  // Get niches
  const { data: niches } = await supabase
    .from("client_niches")
    .select("*, niche_templates(name, description)")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });

  // Get credit summary
  const { data: packs } = await supabase
    .from("credit_packs")
    .select("total_credits, used_credits, expires_at")
    .or(
      profile?.company_id
        ? `client_id.eq.${user.id},company_id.eq.${profile.company_id}`
        : `client_id.eq.${user.id}`
    );

  const now = new Date();
  const activePacks = (packs || []).filter((p) => !p.expires_at || new Date(p.expires_at) > now);
  const totalCredits = activePacks.reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0);
  const totalUsed = (packs || []).reduce((sum, p) => sum + p.used_credits, 0);

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Your account and targeting configuration</p>
      </div>

      {/* Profile Card */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted">Full Name</p>
              <p className="font-medium">{user.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted">Company</p>
              <p className="font-medium">{companyName || "Not assigned"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted">Member Since</p>
              <p className="font-medium">{formatDate(user.created_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Summary */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Account Summary</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{totalCredits}</p>
              <p className="text-xs text-muted">Credits available</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-lg font-bold">{totalUsed}</p>
              <p className="text-xs text-muted">Leads revealed</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-lg font-bold capitalize">{user.role}</p>
              <p className="text-xs text-muted">Account type</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Niches */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">My Niches</h2>
        {!niches?.length ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Target className="w-7 h-7 text-primary" />
            </div>
            <p className="font-semibold mb-1">No niches assigned yet</p>
            <p className="text-sm text-muted">Contact your account manager to set up your targeting criteria.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {niches.map((niche) => (
              <div key={niche.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Target className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{niche.name}</h3>
                      {niche.niche_templates?.description && (
                        <p className="text-sm text-muted">{niche.niche_templates.description}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    niche.is_active ? "bg-success/10 text-success" : "bg-muted/10 text-muted"
                  }`}>
                    {niche.is_active ? "Active" : "Paused"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                  {(niche.geography?.length ?? 0) > 0 && (
                    <div className="flex items-center gap-1.5 text-muted">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{niche.geography.join(", ")}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-muted">
                    <Radio className="w-3.5 h-3.5" />
                    <span>{niche.enabled_signals?.length ?? 0} signals</span>
                  </div>
                  {(niche.excluded_companies?.length ?? 0) > 0 && (
                    <div className="flex items-center gap-1.5 text-muted">
                      <Ban className="w-3.5 h-3.5" />
                      <span>{niche.excluded_companies.length} exclusions</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-muted">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Since {formatDate(niche.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Support */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Need Help?</h2>
        <p className="text-sm text-muted mb-3">
          Want to update your targeting, add new niches, or have questions about your leads?
        </p>
        <a
          href="mailto:info@reachly.com.au"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Mail className="w-4 h-4" /> Contact Support
        </a>
      </div>
    </div>
  );
}
