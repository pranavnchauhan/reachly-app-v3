import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

// Credit pack tiers — price in cents (AUD)
export const CREDIT_PACKS = [
  { id: "pack_10", credits: 10, price: 80_00, label: "10 Credits", perCredit: "$8.00" },
  { id: "pack_25", credits: 25, price: 175_00, label: "25 Credits", perCredit: "$7.00", popular: true },
  { id: "pack_50", credits: 50, price: 300_00, label: "50 Credits", perCredit: "$6.00" },
  { id: "pack_100", credits: 100, price: 500_00, label: "100 Credits", perCredit: "$5.00", best: true },
] as const;
