export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { CreditCard, ArrowDownCircle, ArrowUpCircle, RotateCcw, Clock, AlertTriangle, ShoppingCart } from "lucide-react";
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
  const supabase = await createClient();

  // Get user's company for company-level credits
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  const companyId = profile?.company_id;

  // Fetch user-level packs/transactions
  const [{ data: userPacks }, { data: userTx }] = await Promise.all([
    supabase.from("credit_packs").select("*").eq("client_id", user.id).is("company_id", null).order("purchased_at", { ascending: false }),
    supabase.from("credit_transactions").select("*").eq("client_id", user.id).is("company_id", null).order("created_at", { ascending: false }).limit(50),
  ]);

  // Fetch company-level packs/transactions if user belongs to a company
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Credits</h1>
        <Link
          href="/dashboard/buy-credits"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <ShoppingCart className="w-4 h-4" /> Buy Credits
        </Link>
      </div>

      {purchased && (
        <div className="bg-success/10 border border-success/20 text-success rounded-xl p-4 mb-6 flex items-center gap-3">
          <ArrowDownCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            {purchased} credits purchased successfully! They&apos;re ready to use.
          </p>
        </div>
      )}

      {/* Expiry warning */}
      {daysToExpiry !== null && daysToExpiry <= 14 && daysToExpiry > 0 && (
        <div className="bg-warning/10 border border-warning/20 text-warning rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Credits expiring soon</p>
            <p className="text-sm mt-0.5">
              You have credits expiring in {daysToExpiry} days ({earliestExpiry ? formatDate(earliestExpiry) : ""}).
              Purchase a new pack to roll over your remaining balance.
            </p>
            <Link href="/dashboard/buy-credits" className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium underline underline-offset-2">
              <ShoppingCart className="w-3.5 h-3.5" /> Top up now
            </Link>
          </div>
        </div>
      )}

      {/* Expired credits notice */}
      {expiredCredits > 0 && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-4 mb-6 flex items-start gap-3">
          <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{expiredCredits} credits have expired</p>
            <p className="text-sm mt-0.5">
              Purchase a new pack and these will be rolled over automatically.
            </p>
            <Link href="/dashboard/buy-credits" className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium underline underline-offset-2">
              <ShoppingCart className="w-3.5 h-3.5" /> Renew & roll over
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted">Available</span>
          </div>
          <p className="text-3xl font-bold">{totalCredits}</p>
          {earliestExpiry && totalCredits > 0 && (
            <p className="text-xs text-muted mt-1">
              Earliest expiry: {formatDate(earliestExpiry)}
            </p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <ArrowDownCircle className="w-5 h-5 text-success" />
            <span className="text-sm text-muted">Total Purchased</span>
          </div>
          <p className="text-3xl font-bold">{packs.reduce((sum, p) => sum + p.total_credits, 0)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <ArrowUpCircle className="w-5 h-5 text-warning" />
            <span className="text-sm text-muted">Used</span>
          </div>
          <p className="text-3xl font-bold">{totalUsed}</p>
        </div>
      </div>

      {/* Credit Packs */}
      <h2 className="text-lg font-semibold mb-3">Credit Packs</h2>
      {!packs?.length ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center mb-8">
          <p className="text-muted">No credit packs yet.</p>
          <Link href="/dashboard/buy-credits" className="text-primary hover:underline text-sm mt-2 inline-block">
            Purchase your first pack
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 mb-8">
          {packs.map((pack) => {
            const remaining = pack.total_credits - pack.used_credits;
            const expired = isExpired(pack.expires_at);
            const expiringSoon = pack.expires_at && !expired && daysUntil(pack.expires_at) <= 14;

            return (
              <div
                key={pack.id}
                className={`bg-card border rounded-xl p-4 flex items-center justify-between ${
                  expired ? "border-danger/30 opacity-60" : expiringSoon ? "border-warning/50" : "border-border"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{pack.total_credits} credits</p>
                    {expired && remaining > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-danger/10 text-danger font-medium">Expired</span>
                    )}
                    {expiringSoon && remaining > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">
                        Expires in {daysUntil(pack.expires_at!)}d
                      </span>
                    )}
                    {remaining === 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted/10 text-muted font-medium">Fully used</span>
                    )}
                  </div>
                  <p className="text-sm text-muted">
                    Purchased {formatDate(pack.purchased_at)}
                    {pack.expires_at && (
                      <> · {expired ? "Expired" : "Expires"} {formatDate(pack.expires_at)}</>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{remaining} remaining</p>
                  <div className="w-24 h-1.5 bg-border rounded-full mt-1">
                    <div
                      className={`h-full rounded-full ${expired ? "bg-danger" : expiringSoon ? "bg-warning" : "bg-primary"}`}
                      style={{ width: `${pack.total_credits > 0 ? (remaining / pack.total_credits) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transaction History */}
      <h2 className="text-lg font-semibold mb-3">Transaction History</h2>
      {!transactions?.length ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted">No transactions yet.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-sm font-medium text-muted">Date</th>
                <th className="px-4 py-3 text-sm font-medium text-muted">Type</th>
                <th className="px-4 py-3 text-sm font-medium text-muted">Amount</th>
                <th className="px-4 py-3 text-sm font-medium text-muted">Description</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-sm">{formatDate(tx.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                      tx.type === "purchase" ? "bg-success/10 text-success" :
                      tx.type === "refund" ? "bg-accent/10 text-accent" :
                      "bg-warning/10 text-warning"
                    }`}>
                      {tx.type === "purchase" ? <ArrowDownCircle className="w-3 h-3" /> :
                       tx.type === "refund" ? <RotateCcw className="w-3 h-3" /> :
                       <ArrowUpCircle className="w-3 h-3" />}
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {tx.type === "debit" ? "-" : "+"}{tx.amount}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">{tx.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
