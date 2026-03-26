"use client";

import { useState } from "react";
import { Zap, TrendingUp, Target, Check, Clock, Eye } from "lucide-react";
import { CREDIT_PACKS } from "@/lib/stripe";

const PACK_ICONS = [Zap, TrendingUp, Target];

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
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-3">High-Ticket Leads. Guaranteed Truth.</h1>
        <p className="text-muted max-w-xl mx-auto">
          We don&apos;t sell volume. We sell verified access to decision-makers.
          One credit equals one lead that has cleared our 3-stage Verification Waterfall.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {CREDIT_PACKS.map((pack, i) => {
          const Icon = PACK_ICONS[i];
          const isPopular = "popular" in pack && pack.popular;

          return (
            <div
              key={pack.id}
              className={`relative bg-card border rounded-2xl p-7 flex flex-col ${
                isPopular
                  ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20"
                  : "border-border"
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold">{pack.label}</h2>
              </div>

              <p className="text-sm text-muted mb-4">{pack.description}</p>

              <p className="text-4xl font-bold mb-1">
                ${(pack.price / 100).toLocaleString()}
              </p>

              <div className="flex items-center gap-1.5 text-sm text-muted mb-5">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Credits valid for {pack.validity}{" "}
                  <span className="text-muted/70">({pack.validityNote})</span>
                </span>
              </div>

              <div className="space-y-3 mb-6 flex-1">
                {pack.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleBuy(pack.id)}
                disabled={loading !== null}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${
                  isPopular
                    ? "bg-gradient-to-r from-primary to-primary-hover text-white hover:shadow-lg hover:shadow-primary/20"
                    : "bg-primary text-white hover:bg-primary-hover"
                }`}
              >
                {loading === pack.id ? "Redirecting to checkout..." : "Get Started"}
              </button>

              <button className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-muted hover:text-foreground transition-colors py-2">
                <Eye className="w-4 h-4" />
                Preview Sample Lead
              </button>
            </div>
          );
        })}
      </div>

      <div className="bg-card/80 border border-border/50 rounded-xl p-5 text-center">
        <p className="text-sm">
          <span className="font-semibold">Stay Active, Stay Verified:</span>{" "}
          <span className="text-muted italic">
            Top up any pack before expiry to roll over your entire remaining balance into the new period. We value your investment.
          </span>
        </p>
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        Not ready to commit?{" "}
        <a href="https://cal.com/reachly" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          Book a demo
        </a>{" "}
        to receive a sample verified lead first.
      </p>
    </div>
  );
}
