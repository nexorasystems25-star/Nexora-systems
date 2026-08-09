export interface Product {
  id: string;
  name: string;
  slug: string;
  status: "active" | "development" | "deprecated";
  owner: string;
  repository: string;
  description: string;
  pricing: {
    tiers: string[];
    basePrice: number;
    currency: string;
  };
  dependencies: string[];
  deployment: {
    environment: string;
    region: string;
    autoDeploy: boolean;
  };
}

export const PRODUCT_REGISTRY: Product[] = [
  {
    id: "churchflow-001",
    name: "ChurchFlow",
    slug: "churchflow",
    status: "active",
    owner: "cpo-001",
    repository: "https://github.com/nexorasystems/churchflow",
    description: "Church management SaaS platform",
    pricing: {
      tiers: ["free", "starter", "professional", "enterprise"],
      basePrice: 0,
      currency: "USD",
    },
    dependencies: ["@nexora/auth", "@nexora/billing", "@nexora/db", "@nexora/ui"],
    deployment: {
      environment: "production",
      region: "us-east-1",
      autoDeploy: true,
    },
  },
  {
    id: "school-suite-001",
    name: "School Suite",
    slug: "school-suite",
    status: "development",
    owner: "cpo-001",
    repository: "https://github.com/nexorasystems/school-suite",
    description: "Education management platform",
    pricing: {
      tiers: ["free", "starter", "professional"],
      basePrice: 0,
      currency: "USD",
    },
    dependencies: ["@nexora/auth", "@nexora/billing", "@nexora/db"],
    deployment: {
      environment: "staging",
      region: "us-east-1",
      autoDeploy: false,
    },
  },
  {
    id: "counseling-001",
    name: "Counseling",
    slug: "counseling",
    status: "development",
    owner: "cpo-001",
    repository: "https://github.com/nexorasystems/counseling",
    description: "Therapy and mental health platform",
    pricing: {
      tiers: ["free", "starter", "professional"],
      basePrice: 0,
      currency: "USD",
    },
    dependencies: ["@nexora/auth", "@nexora/billing", "@nexora/db"],
    deployment: {
      environment: "staging",
      region: "us-east-1",
      autoDeploy: false,
    },
  },
  {
    id: "susu-001",
    name: "Susu",
    slug: "susu",
    status: "development",
    owner: "cpo-001",
    repository: "https://github.com/nexorasystems/susu",
    description: "Savings and community finance platform",
    pricing: {
      tiers: ["free", "starter", "community"],
      basePrice: 0,
      currency: "USD",
    },
    dependencies: ["@nexora/auth", "@nexora/billing", "@nexora/db"],
    deployment: {
      environment: "staging",
      region: "us-east-1",
      autoDeploy: false,
    },
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCT_REGISTRY.find(product => product.slug === slug);
}

export function getActiveProducts(): Product[] {
  return PRODUCT_REGISTRY.filter(product => product.status === "active");
}
