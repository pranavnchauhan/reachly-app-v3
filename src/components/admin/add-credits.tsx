"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

interface CreditPack {
  id: string;
  total_credits: number;
  used_credits: number;
  purchased_at: string;
  description?: string;
  source?: string;
}

interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export function AddCredits({
  companyId,
  clientId,
  currentBalance,
  packs,
  transactions,
}: {
  companyId?: string;
  clientId?: string;
  currentBalance: number;
  packs?: CreditPack[];
  transactions?: CreditTransaction[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState(10);
  const [description, setDescription] = useState("Manual top-up (admin)");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/admin/add-credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: companyId || null,
        clientId: clientId || null,
        amount,
        description,
      }),
    });

    if (res.ok) {
      setShowForm(false);
      setAmount(10);
      setDescription("Manual top-up (admin)");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {/* Balance + Add button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">Available Balance</p>
          <p className="text-3xl font-bold">{currentBalance} <span className="text-sm font-normal text-muted">credits</span></p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-hover transition-colors">
            <Plus className="w-3 h-3" /> Add Credits
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Amount</label>
              <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))}
                className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1">Description</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Monthly allocation, Bonus credits" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50">
              {loading ? "Adding..." : `Add ${amount} Credits`}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-background">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Credit Packs */}
      {packs && packs.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Credit Packs</h4>
          <div className="space-y-1.5">
            {packs.map((pack) => (
              <div key={pack.id} className="flex items-center justify-between p-2.5 bg-background/50 border border-border/30 rounded-lg text-sm">
                <div>
                  <span className="font-medium">{pack.total_credits - pack.used_credits}</span>
                  <span className="text-muted">/{pack.total_credits} remaining</span>
                  {pack.description && <span className="text-xs text-muted ml-2">— {pack.description}</span>}
                </div>
                <span className="text-xs text-muted">{new Date(pack.purchased_at).toLocaleDateString("en-AU")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {transactions && transactions.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Recent Transactions</h4>
          <div className="space-y-1">
            {transactions.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-1.5 text-sm border-b border-border/20 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${tx.type === "purchase" ? "bg-success" : tx.type === "refund" ? "bg-warning" : "bg-primary"}`} />
                  <span className="text-muted">{tx.description}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-medium ${tx.type === "debit" ? "text-danger" : "text-success"}`}>
                    {tx.type === "debit" ? "-" : "+"}{tx.amount}
                  </span>
                  <span className="text-xs text-muted">{new Date(tx.created_at).toLocaleDateString("en-AU")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
