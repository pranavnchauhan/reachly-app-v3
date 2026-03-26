
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreditCard, ArrowDownCircle, ArrowUpCircle, RotateCcw, Clock, AlertTriangle, ShoppingCart, Zap } from "lucide-react";
import Link from "next/link";

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) <= new Date();
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ purchased?: string }>;
}) {
  const { purchased } = await searchParams;
  const user = await getUser();
  const supabase = createAdminClient();

  // Get user's company for company-level credits
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  const companyId = profile?.company_id;

  // Fetch user-level packs/transactions
  const [{ data: userPacks }, { data: userTx }] = await Promise.all([
    supabase.from("credit_packs").select("*").eq("client_id", user.id).order("purchased_at", { ascending: false }),
    supabase.from("credit_transactions").select("*").eq("client_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);

  // Fetch company-level packs/transactions
  let companyPacks: typeof userPacks = [];
  let companyTx: typeof userTx = [];
  if (companyId) {
    const [p, t] = await Promise.all([
      supabase.from("credit_packs").select("*").eq("company_id", companyId).order("purchased_at", { ascending: false }),
      supabase.from("credit_transactions").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(50),
    ]);
    companyPacks = p.data || [];
    companyTx = t.data || [];
  }

  const packs = [...(companyPacks || []), ...(userPacks || [])];
  const transactions = [...(companyTx || []), ...(userTx || [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50);

  // Only count non-expired credits
  const activePacks = packs.filter((p) => !isExpired(p.expires_at));
  const expiredPacks = packs.filter((p) => isExpired(p.expires_at) && p.total_credits - p.used_credits > 0);

  const totalCredits = activePacks.reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0);
  const totalPurchased = packs.reduce((sum, p) => sum + p.total_credits, 0);
  const totalUsed = packs.reduce((sum, p) => sum + p.used_credits, 0);
  const expiredCredits = expiredPacks.reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0);

  // Find earliest expiry among active packs with remaining credits
  const activePacksWithCredits = activePacks.filter((p) => p.total_credits - p.used_credits > 0 && p.expires_at);
  const earliestExpiry = activePacksWithCredits.length > 0
    ? activePacksWithCredits.reduce((earliest, p) =>
        !earliest || new Date(p.expires_at!) < new Date(earliest) ? p.expires_at! : earliest,
      "" as string)
    : null;
  const daysToExpiry = earliestExpiry ? daysUntil(earliestExpiry) : null;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Credits</h1>
          <p className="text-sm text-muted mt-0.5">Manage your lead reveal credits</p>
        </div>
        <Link
          href="/dashboard/buy-credits"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors"
        >
          <ShoppingCart className="w-4 h-4" /> Buy Credits
        </Link>
      </div>

      {/* Purchase success */}
      {purchased && (
        <div className="bg-success/10 border border-success/20 text-success rounded-2xl p-4 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
            <ArrowDownCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">{purchased} credits added!</p>
            <p className="text-sm opacity-80">Ready to use for revealing leads.</p>
          </div>
        </div>
      )}

      {/* Expiry warning */}
      {daysToExpiry !== null && daysToExpiry <= 14 && daysToExpiry > 0 && (
        <div className="bg-warning/5 border border-warning/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Credits expiring in {daysToExpiry} days</p>
            <p className="text-sm text-muted mt-0.5">
              Purchase a new pack before {formatDate(earliestExpiry!)} to roll over your remaining balance automatically.
            </p>
          </div>
          <Link href="/dashboard/buy-credits" className="flex items-center gap-2 px-4 py-2 bg-warning text-white rounded-xl text-sm font-medium hover:bg-warning/90 transition-colors flex-shrink-0">
            Top Up
          </Link>
        </div>
      )}

      {/* Expired credits notice */}
      {expiredCredits > 0 && (
        <div className="bg-danger/5 border border-danger/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-danger" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-danger">{expiredCredits} credits have expired</p>
            <p className="text-sm text-muted mt-0.5">
              Purchase a new pack and these will be rolled over automatically into your new balance.
            </p>
          </div>
          <Link href="/dashboard/buy-credits" className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors flex-shrink-0">
            Renew
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="text-3xl font-bold">{totalCredits}</p>
          <p className="text-sm text-muted mt-0.5">Available</p>
          {earliestExpiry && totalCredits > 0 && (
            <p className="text-xs text-muted/70 mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Expires {formatDate(earliestExpiry)}
            </p>
          )}
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5 text-success" />
            </div>
          </div>
          <p className="text-3xl font-bold">{totalPurchased}</p>
          <p className="text-sm text-muted mt-0.5">Total Purchased</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-warning" />
            </div>
          </div>
          <p className="text-3xl font-bold">{totalUsed}</p>
          <p className="text-sm text-muted mt-0.5">Used</p>
        </div>
      </div>

      {/* Credit Packs */}
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Credit Packs</h2>
      {!packs?.length ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-7 h-7 text-primary" />
          </div>
          <p className="font-semibold mb-1">No credit packs yet</p>
          <p className="text-sm text-muted mb-4">Purchase a pack to start revealing triple-verified leads.</p>
          <Link href="/dashboard/buy-credits" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
            <ShoppingCart className="w-4 h-4" /> Get Started
          </Link>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {packs.map((pack) => {
            const remaining = pack.total_credits - pack.used_credits;
            const expired = isExpired(pack.expires_at);
            const expiringSoon = pack.expires_at && !expired && daysUntil(pack.expires_at) <= 14;
            const pct = pack.total_credits > 0 ? (remaining / pack.total_credits) * 100 : 0;

            return (
              <div
                key={pack.id}
                className={`bg-card border rounded-2xl p-5 ${
                  expired ? "border-danger/30 opacity-60" : expiringSoon ? "border-warning/40" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <p className="font-semibold">{pack.total_credits} credits</p>
                    {expired && remaining > 0 && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-danger/10 text-danger font-medium">Expired</span>
                    )}
                    {expiringSoon && remaining > 0 && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-warning/10 text-warning font-medium">
                        Expires in {daysUntil(pack.expires_at!)}d
                      </span>
                    )}
                    {remaining === 0 && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-muted/10 text-muted font-medium">Fully used</span>
                    )}
                    {!expired && remaining > 0 && !expiringSoon && pack.expires_at && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-success/10 text-success font-medium">Active</span>
                    )}
                    {!pack.expires_at && remaining > 0 && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">No expiry</span>
                    )}
                  </div>
                  <p className="font-bold text-lg">{remaining} <span className="text-sm font-normal text-muted">remaining</span></p>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-border rounded-full mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${
                      expired ? "bg-danger" : expiringSoon ? "bg-warning" : "bg-primary"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm text-muted">
                  <span>Purchased {formatDate(pack.purchased_at)}</span>
                  {pack.expires_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {expired ? "Expired" : "Expires"} {formatDate(pack.expires_at)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transaction History */}
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Transaction History</h2>
      {!transactions?.length ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <p className="text-muted">No transactions yet.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider">Date</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider">Type</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border/50 last:border-0 hover:bg-background/50 transition-colors">
                  <td className="px-5 py-3.5 text-sm">{formatDate(tx.created_at)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                      tx.type === "purchase" ? "bg-success/10 text-success" :
                      tx.type === "refund" ? "bg-accent/10 text-accent" :
                      "bg-warning/10 text-warning"
                    }`}>
                      {tx.type === "purchase" ? <ArrowDownCircle className="w-3 h-3" /> :
                       tx.type === "refund" ? <RotateCcw className="w-3 h-3" /> :
                       <ArrowUpCircle className="w-3 h-3" />}
                      {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold">
                    <span className={tx.type === "debit" ? "text-warning" : "text-success"}>
                      {tx.type === "debit" ? "-" : "+"}{tx.amount}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted">{tx.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
