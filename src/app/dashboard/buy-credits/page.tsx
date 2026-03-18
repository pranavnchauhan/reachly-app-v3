"use client";

import { useState } from "react";
import { CreditCard, Zap, Star, Check } from "lucide-react";

const PACKS = [
  { id: "pack_10", credits: 10, price: 80, perCredit: 8.0, label: "Starter" },
  { id: "pack_25", credits: 25, price: 175, perCredit: 7.0, label: "Growth", popular: true },
  { id: "pack_50", credits: 50, price: 300, perCredit: 6.0, label: "Professional" },
  { id: "pack_100", credits: 100, price: 500, perCredit: 5.0, label: "Enterprise", best: true },
];

export default function BuyCreditsPage() {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleBuy(packId: string) {
    setLoading(packId);

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId }),
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error || "Failed to create checkout session");
      setLoading(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Buy Credits</h1>
        <p className="text-muted">Each credit reveals one qualified lead with full contact details and outreach materials.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PACKS.map((pack) => (
          <div
            key={pack.id}
            className={`relative bg-card border rounded-xl p-6 flex flex-col ${
              pack.popular
                ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20"
                : "border-border"
            }`}
          >
            {pack.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3" /> Most Popular
                </span>
              </div>
            )}
            {pack.best && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-success text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Best Value
                </span>
              </div>
            )}

            <div className="text-center mb-4">
              <p className="text-sm font-medium text-muted mb-1">{pack.label}</p>
              <p className="text-4xl font-bold">{pack.credits}</p>
              <p className="text-sm text-muted">credits</p>
            </div>

            <div className="text-center mb-4 pb-4 border-b border-border">
              <p className="text-2xl font-bold">${pack.price}</p>
              <p className="text-xs text-muted">AUD (incl. GST)</p>
            </div>

            <div className="space-y-2 mb-6 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-success flex-shrink-0" />
                <span>${pack.perCredit.toFixed(2)} per lead</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-success flex-shrink-0" />
                <span>Full contact details</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-success flex-shrink-0" />
                <span>AI outreach emails</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-success flex-shrink-0" />
                <span>Never expires</span>
              </div>
            </div>

            <button
              onClick={() => handleBuy(pack.id)}
              disabled={loading !== null}
              className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                pack.popular
                  ? "bg-primary text-white hover:bg-primary-hover"
                  : "bg-background border border-border hover:bg-primary hover:text-white hover:border-primary"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              {loading === pack.id ? "Redirecting..." : "Buy Now"}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center text-sm text-muted">
        <p>Secure payment powered by Stripe. Credits are added instantly after payment.</p>
        <p className="mt-1">Need a custom volume? Contact us at <a href="mailto:hello@reachly.com.au" className="text-primary hover:underline">hello@reachly.com.au</a></p>
      </div>
    </div>
  );
}
