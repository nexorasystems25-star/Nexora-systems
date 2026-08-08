export const PRODUCT_DOMAINS: Record<string, string> = {
  churchflow: "churchflow.app",
  "school-suite": "schoolsuite.app",
  counseling: "counseling.app",
  susu: "susu.app",
};

export const PRODUCT_SLUGS = Object.keys(PRODUCT_DOMAINS);

export function getProductDomain(productSlug: string): string | null {
  return PRODUCT_DOMAINS[productSlug] || null;
}

export function getProductSlugFromDomain(domain: string): string | null {
  for (const [slug, baseDomain] of Object.entries(PRODUCT_DOMAINS)) {
    if (domain === baseDomain || domain.endsWith(`.${baseDomain}`)) {
      return slug;
    }
  }
  return null;
}
