import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});

export const PLANS = {
  free: {
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: ["Up to 50 members", "Basic events", "Limited reports"],
  },
  starter: {
    name: "Starter",
    monthlyPrice: 9900,
    yearlyPrice: 99000,
    features: ["Up to 200 members", "Events & attendance", "Basic finance tracking", "Email support"],
    stripeMonthlyPriceId: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    stripeYearlyPriceId: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
  },
  pro: {
    name: "Pro",
    monthlyPrice: 29900,
    yearlyPrice: 299000,
    features: ["Unlimited members", "Full events", "Finance & reports", "Communication", "Priority support"],
    stripeMonthlyPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    stripeYearlyPriceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  },
  enterprise: {
    name: "Enterprise",
    monthlyPrice: 59900,
    yearlyPrice: 599000,
    features: ["Everything in Pro", "Custom integrations", "Dedicated support", "SLA guarantee"],
    stripeMonthlyPriceId: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
    stripeYearlyPriceId: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
  },
} as const;

export type PlanTier = keyof typeof PLANS;
