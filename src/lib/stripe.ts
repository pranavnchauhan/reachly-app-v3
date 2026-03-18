import Stripe from "stripe";

// Lazy-init to avoid crashing at build time when env var is missing
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// Credit pack tiers — price in cents (AUD)
export const CREDIT_PACKS = [
  { id: "pack_10", credits: 10, price: 80_00, label: "10 Credits", perCredit: "$8.00" },
  { id: "pack_25", credits: 25, price: 175_00, label: "25 Credits", perCredit: "$7.00", popular: true },
  { id: "pack_50", credits: 50, price: 300_00, label: "50 Credits", perCredit: "$6.00" },
  { id: "pack_100", credits: 100, price: 500_00, label: "100 Credits", perCredit: "$5.00", best: true },
] as const;
