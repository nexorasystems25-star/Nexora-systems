export type BillingInterval = "month" | "year";

export interface PlanTier {
  name: string;
  price: number; // in pesewas (GHS * 100)
  priceDisplay: string; // e.g., "GHS 99"
  interval: BillingInterval;
  features: string[];
  stripePriceId?: string;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  tiers: PlanTier[];
}

// ============================================================================
// PRODUCT PRICING
// ============================================================================

export const PLANS: Plan[] = [
  // ChurchFlow
  {
    id: "churchflow",
    name: "ChurchFlow",
    slug: "churchflow",
    tiers: [
      {
        name: "Starter",
        price: 9900,
        priceDisplay: "GHS 99",
        interval: "month",
        features: [
          "Up to 100 members",
          "Basic reporting",
          "Email support",
          "Mobile app access",
        ],
      },
      {
        name: "Professional",
        price: 29900,
        priceDisplay: "GHS 299",
        interval: "month",
        features: [
          "Up to 500 members",
          "Advanced reporting",
          "Priority support",
          "Mobile app access",
          "SMS notifications",
          "Custom groups",
        ],
      },
      {
        name: "Enterprise",
        price: 59900,
        priceDisplay: "GHS 599",
        interval: "month",
        features: [
          "Unlimited members",
          "Custom reporting",
          "24/7 support",
          "Mobile app access",
          "SMS notifications",
          "Custom groups",
          "API access",
          "Custom integrations",
        ],
      },
    ],
  },
  // School Suite
  {
    id: "school-suite",
    name: "School Suite",
    slug: "school-suite",
    tiers: [
      {
        name: "Starter",
        price: 14900,
        priceDisplay: "GHS 149",
        interval: "month",
        features: [
          "Up to 200 students",
          "Basic gradebook",
          "Attendance tracking",
          "Parent portal",
        ],
      },
      {
        name: "Professional",
        price: 39900,
        priceDisplay: "GHS 399",
        interval: "month",
        features: [
          "Up to 1000 students",
          "Advanced gradebook",
          "Fee management",
          "Staff management",
          "Academic calendar",
          "Reports",
        ],
      },
      {
        name: "Enterprise",
        price: 79900,
        priceDisplay: "GHS 799",
        interval: "month",
        features: [
          "Unlimited students",
          "Custom reporting",
          "24/7 support",
          "API access",
          "Custom integrations",
          "Multi-campus",
        ],
      },
    ],
  },
  // Counseling Platform
  {
    id: "counseling",
    name: "Counseling Platform",
    slug: "counseling",
    tiers: [
      {
        name: "Starter",
        price: 19900,
        priceDisplay: "GHS 199",
        interval: "month",
        features: [
          "Up to 50 clients",
          "Appointment scheduling",
          "Session notes",
          "Basic billing",
        ],
      },
      {
        name: "Professional",
        price: 49900,
        priceDisplay: "GHS 499",
        interval: "month",
        features: [
          "Up to 200 clients",
          "Telehealth integration",
          "Outcome tracking",
          "Insurance billing",
          "Reports",
        ],
      },
      {
        name: "Enterprise",
        price: 89900,
        priceDisplay: "GHS 899",
        interval: "month",
        features: [
          "Unlimited clients",
          "Custom reporting",
          "24/7 support",
          "API access",
          "Custom integrations",
        ],
      },
    ],
  },
  // Susu Platform
  {
    id: "susu",
    name: "Susu Platform",
    slug: "susu",
    tiers: [
      {
        name: "Starter",
        price: 14900,
        priceDisplay: "GHS 149",
        interval: "month",
        features: [
          "Up to 100 members",
          "Contribution tracking",
          "Basic reports",
          "SMS notifications",
        ],
      },
      {
        name: "Professional",
        price: 34900,
        priceDisplay: "GHS 349",
        interval: "month",
        features: [
          "Up to 500 members",
          "Mobile money integration",
          "Payout management",
          "Advanced reports",
          "API access",
        ],
      },
      {
        name: "Enterprise",
        price: 69900,
        priceDisplay: "GHS 699",
        interval: "month",
        features: [
          "Unlimited members",
          "Custom reporting",
          "24/7 support",
          "Custom integrations",
          "Multi-group management",
        ],
      },
    ],
  },
];

// ============================================================================
// BUNDLE DISCOUNTS
// ============================================================================

export interface BundleDiscount {
  productCount: number;
  discountPercent: number;
  label: string;
}

export const BUNDLE_DISCOUNTS: BundleDiscount[] = [
  { productCount: 2, discountPercent: 15, label: "2-Product Bundle" },
  { productCount: 3, discountPercent: 25, label: "3-Product Bundle" },
  { productCount: 4, discountPercent: 30, label: "All-Products Bundle" },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getPlanById(planId: string): Plan | undefined {
  return PLANS.find((plan) => plan.id === planId);
}

export function getPlanBySlug(slug: string): Plan | undefined {
  return PLANS.find((plan) => plan.slug === slug);
}

export function getTierByPrice(plan: Plan, price: number): PlanTier | undefined {
  return plan.tiers.find((tier) => tier.price === price);
}

export function calculateBundleDiscount(
  productCount: number,
  baseTotal: number
): { discount: number; discountPercent: number; finalTotal: number } {
  const bundle = BUNDLE_DISCOUNTS.find(
    (b) => b.productCount === Math.min(productCount, 4)
  );

  if (!bundle) {
    return { discount: 0, discountPercent: 0, finalTotal: baseTotal };
  }

  const discount = Math.round(baseTotal * (bundle.discountPercent / 100));
  return {
    discount,
    discountPercent: bundle.discountPercent,
    finalTotal: baseTotal - discount,
  };
}

export function formatPrice(pesewas: number): string {
  const ghs = pesewas / 100;
  return `GHS ${ghs.toFixed(2)}`;
}
