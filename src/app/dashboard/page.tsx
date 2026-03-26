export const dynamic = "force-dynamic";

import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Zap, CreditCard, Target, Layers, ArrowRight, ShoppingCart, Clock, Eye } from "lucide-react";
import Link from "next/link";

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default async function ClientDashboard() {
  const user = await getUser();
  const supabase = createAdminClient();

  const { data: niches } = await supabase
    .from("client_niches")
    .select("id, name")
    .eq("client_id", user.id)
    .eq("is_active", true);

  const nicheIds = niches?.map((n) => n.id) ?? [];

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  const companyId = profile?.company_id;

  const [
    { count: availableLeads },
    { count: revealedLeads },
    { data: userPacks },
    { data: companyPacks },
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
    supabase.from("credit_packs").select("total_credits, used_credits, expires_at").eq("client_id", user.id),
    companyId
      ? supabase.from("credit_packs").select("total_credits, used_credits, expires_at").eq("company_id", companyId)
      : { data: [] },
  ]);

  const allPacks = [...(userPacks || []), ...(companyPacks || [])];
  const now = new Date();
  const activePacks = allPacks.filter((p) => !p.expires_at || new Date(p.expires_at) > now);
  const totalCredits = activePacks.reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0);
  const totalUsed = allPacks.reduce((sum, p) => sum + p.used_credits, 0);

  // Find earliest expiry
  const packsWithExpiry = activePacks.filter((p) => p.total_credits - p.used_credits > 0 && p.expires_at);
  const earliestExpiry = packsWithExpiry.length > 0
    ? packsWithExpiry.reduce((e, p) => !e || new Date(p.expires_at!) < new Date(e) ? p.expires_at! : e, "" as string)
    : null;
  const daysToExpiry = earliestExpiry ? daysUntil(earliestExpiry) : null;

  const firstName = user.full_name.split(" ")[0];

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Welcome back, {firstName}</h1>
        <p className="text-muted text-sm">Your lead generation command centre.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link href="/dashboard/leads" className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <ArrowRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-bold">{availableLeads ?? 0}</p>
          <p className="text-sm text-muted mt-0.5">New Leads</p>
        </Link>

        <Link href="/dashboard/leads" className="group bg-card border border-border rounded-2xl p-5 hover:border-success/40 hover:shadow-md hover:shadow-success/5 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-success" />
            </div>
            <ArrowRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-bold">{revealedLeads ?? 0}</p>
          <p className="text-sm text-muted mt-0.5">Revealed</p>
        </Link>

        <Link href="/dashboard/credits" className="group bg-card border border-border rounded-2xl p-5 hover:border-accent/40 hover:shadow-md hover:shadow-accent/5 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-accent" />
            </div>
            <ArrowRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-bold">{totalCredits}</p>
          <p className="text-sm text-muted mt-0.5">Credits Available</p>
          {earliestExpiry && totalCredits > 0 && (
            <p className="text-xs text-muted/70 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Expires {formatDate(earliestExpiry)}
            </p>
          )}
        </Link>

        <Link href="/dashboard/settings" className="group bg-card border border-border rounded-2xl p-5 hover:border-warning/40 hover:shadow-md hover:shadow-warning/5 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <Layers className="w-5 h-5 text-warning" />
            </div>
            <ArrowRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-bold">{niches?.length ?? 0}</p>
          <p className="text-sm text-muted mt-0.5">Active Niches</p>
        </Link>
      </div>

      {/* Credit expiry warning */}
      {daysToExpiry !== null && daysToExpiry <= 14 && daysToExpiry > 0 && (
        <div className="bg-warning/5 border border-warning/20 rounded-2xl p-5 mb-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Credits expiring in {daysToExpiry} days</p>
            <p className="text-sm text-muted mt-0.5">
              Top up before {formatDate(earliestExpiry!)} to roll over your remaining {totalCredits} credits.
            </p>
          </div>
          <Link href="/dashboard/buy-credits" className="flex items-center gap-2 px-4 py-2 bg-warning text-white rounded-xl text-sm font-medium hover:bg-warning/90 transition-colors flex-shrink-0">
            <ShoppingCart className="w-4 h-4" /> Top Up
          </Link>
        </div>
      )}

      {/* New leads CTA */}
      {(availableLeads ?? 0) > 0 && (
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold mb-1">
                {availableLeads === 1 ? "A new lead is" : `${availableLeads} new leads are`} ready!
              </h2>
              <p className="text-sm text-muted">
                Triple-verified decision-makers waiting to be revealed. Each reveal costs 1 credit.
              </p>
            </div>
            <Link href="/dashboard/leads"
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors flex-shrink-0 ml-4">
              <Eye className="w-4 h-4" /> View Leads
            </Link>
          </div>
        </div>
      )}

      {/* No credits */}
      {totalCredits === 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold mb-1">Get started with credits</h2>
              <p className="text-sm text-muted">
                You need credits to reveal verified lead contact details. Each credit unlocks one triple-verified decision-maker.
              </p>
            </div>
            <Link href="/dashboard/buy-credits"
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors flex-shrink-0 ml-4">
              <ShoppingCart className="w-4 h-4" /> Buy Credits
            </Link>
          </div>
        </div>
      )}

      {/* Quick stats summary */}
      {totalUsed > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Your Activity</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-2xl font-bold">{totalUsed}</p>
              <p className="text-sm text-muted">Leads revealed</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCredits + totalUsed}</p>
              <p className="text-sm text-muted">Total credits purchased</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCredits > 0 && totalUsed > 0 ? Math.round((totalUsed / (totalCredits + totalUsed)) * 100) : 0}%</p>
              <p className="text-sm text-muted">Utilisation rate</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {(availableLeads ?? 0) === 0 && (revealedLeads ?? 0) === 0 && totalCredits > 0 && (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-bold mb-2">Leads incoming</h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            Our pipeline is finding and verifying the best decision-makers for your niche. Your leads will appear here once they&apos;re ready.
          </p>
        </div>
      )}

      {/* Active niches */}
      {niches && niches.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Active Niches</h2>
          <div className="flex flex-wrap gap-2">
            {niches.map((niche) => (
              <span key={niche.id} className="px-3 py-1.5 bg-primary/5 border border-primary/15 text-sm rounded-lg text-foreground">
                {niche.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
