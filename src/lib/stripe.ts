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

// Credit pack tiers — price in cents (AUD), matching reachly.com.au pricing
export const CREDIT_PACKS = [
  {
    id: "pilot",
    credits: 10,
    price: 999_00,
    validityMonths: 4,
    label: "The Pilot Pack",
    description: "Test the waters with verified leads.",
    validity: "4 Months",
    validityNote: "Quarter + Buffer",
    features: [
      "10 Verified Truth Reveals",
      "Triple-Verified Contacts",
      "0% Bounce Guarantee",
      "Standard Support",
    ],
  },
  {
    id: "growth",
    credits: 20,
    price: 1799_00,
    validityMonths: 9,
    label: "The Growth Engine",
    description: "Scale your outreach with priority access.",
    validity: "9 Months",
    validityNote: "Multi-Quarter Strategy",
    popular: true,
    features: [
      "20 Verified Truth Reveals",
      "Priority Niche Setup",
      "0% Bounce Guarantee",
      "Priority Support",
    ],
  },
  {
    id: "scale",
    credits: 50,
    price: 3999_00,
    validityMonths: 14,
    label: "The Scale Accelerator",
    description: "Enterprise-grade lead generation.",
    validity: "14 Months",
    validityNote: "Annual+ Peace of Mind",
    features: [
      "50 Verified Truth Reveals",
      "Custom Niche Development",
      "0% Bounce Guarantee",
      "Dedicated Success Manager",
    ],
  },
] as const;
