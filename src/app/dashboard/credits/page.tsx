export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { CreditCard, ArrowDownCircle, ArrowUpCircle, RotateCcw } from "lucide-react";

export default async function CreditsPage() {
  const user = await getUser();
  const supabase = await createClient();

  const [{ data: packs }, { data: transactions }] = await Promise.all([
    supabase.from("credit_packs").select("*").eq("client_id", user.id).order("purchased_at", { ascending: false }),
    supabase.from("credit_transactions").select("*").eq("client_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);

  const totalCredits = packs?.reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0) ?? 0;
  const totalUsed = packs?.reduce((sum, p) => sum + p.used_credits, 0) ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Credits</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted">Available</span>
          </div>
          <p className="text-3xl font-bold">{totalCredits}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <ArrowDownCircle className="w-5 h-5 text-success" />
            <span className="text-sm text-muted">Total Purchased</span>
          </div>
          <p className="text-3xl font-bold">{packs?.reduce((sum, p) => sum + p.total_credits, 0) ?? 0}</p>
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
          <p className="text-muted">No credit packs yet. Contact us to purchase credits.</p>
        </div>
      ) : (
        <div className="grid gap-3 mb-8">
          {packs.map((pack) => (
            <div key={pack.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{pack.total_credits} credits</p>
                <p className="text-sm text-muted">
                  Purchased {new Date(pack.purchased_at).toLocaleDateString()}
                  {pack.expires_at && ` · Expires ${new Date(pack.expires_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{pack.total_credits - pack.used_credits} remaining</p>
                <div className="w-24 h-1.5 bg-border rounded-full mt-1">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${((pack.total_credits - pack.used_credits) / pack.total_credits) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
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
                  <td className="px-4 py-3 text-sm">{new Date(tx.created_at).toLocaleDateString()}</td>
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
