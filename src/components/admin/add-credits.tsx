"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function AddCredits({ clientId, currentBalance }: { clientId: string; currentBalance: number }) {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/admin/add-credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, amount }),
    });

    if (res.ok) {
      setShowForm(false);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm">Current balance: <span className="font-bold text-lg">{currentBalance} credits</span></p>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-sm text-primary hover:underline">
            <Plus className="w-4 h-4" /> Add Credits
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="flex items-center gap-3 mt-3">
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))}
            className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50">
            {loading ? "Adding..." : "Add"}
          </button>
          <button type="button" onClick={() => setShowForm(false)}
            className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-background">
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
