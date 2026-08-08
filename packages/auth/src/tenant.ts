import { eq } from "drizzle-orm";
import { db } from "../../db";
import { organizations, tenantDomains } from "../../db/schema-platform";
import { PRODUCT_DOMAINS } from "../../config/src/domains";

// ============================================================================
// NEW: Tenant Resolution Helpers (Domain-based routing)
// ============================================================================

export interface TenantContext {
  organizationId: string;
  slug: string;
  name: string;
  productSlug: string;
}

/**
 * Resolve tenant from a full domain (subdomain or custom domain).
 * Example: "grag.churchflow.app" → { slug: "grag", productSlug: "churchflow" }
 */
export async function resolveTenantFromDomain(
  domain: string
): Promise<TenantContext | null> {
  const host = domain.split(":")[0].toLowerCase();

  // 1. Exact domain match in tenant_domains table
  const [tenantDomain] = await db
    .select()
    .from(tenantDomains)
    .where(eq(tenantDomains.domain, host))
    .limit(1);

  if (tenantDomain) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, tenantDomain.organizationId))
      .limit(1);

    if (org && org.status === "active") {
      return {
        organizationId: org.id,
        slug: org.slug,
        name: org.name,
        productSlug: tenantDomain.productSlug,
      };
    }
  }

  // 2. Subdomain extraction (e.g., "grag.churchflow.app" → slug "grag")
  for (const [productSlug, baseDomain] of Object.entries(PRODUCT_DOMAINS)) {
    if (host.endsWith(`.${baseDomain}`)) {
      const slug = host.replace(`.${baseDomain}`, "");
      return resolveTenantFromSlug(slug, productSlug);
    }
  }

  return null;
}

/**
 * Resolve tenant from organization slug and product.
 * Used for path-based fallback: /church/[slug]
 */
export async function resolveTenantFromSlug(
  slug: string,
  productSlug: string
): Promise<TenantContext | null> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org || org.status !== "active") return null;

  return {
    organizationId: org.id,
    slug: org.slug,
    name: org.name,
    productSlug,
  };
}

/**
 * Extract tenant slug from hostname without DB lookup.
 * Synchronous, fast path for subdomains.
 */
export function extractSlugFromHostname(
  hostname: string
): { slug: string; productSlug: string } | null {
  const host = hostname.split(":")[0].toLowerCase();

  for (const [productSlug, baseDomain] of Object.entries(PRODUCT_DOMAINS)) {
    if (host.endsWith(`.${baseDomain}`)) {
      const slug = host.replace(`.${baseDomain}`, "");
      if (slug) {
        return { slug, productSlug };
      }
    }
  }

  return null;
}

// ============================================================================
// LEGACY: Role permissions and header-based tenant context
// ============================================================================

import type { AuthUser } from "./types";

// Role permissions mapping
const ROLE_PERMISSIONS: Record<string, string[]> = {
  platform_owner: [
    "members.read", "members.write", "members.delete",
    "events.read", "events.write", "events.delete",
    "finance.read", "finance.write", "finance.approve",
    "reports.read", "settings.read", "settings.write",
    "tenant.manage", "platform.manage",
  ],
  nexora_staff: [
    "members.read", "members.write",
    "events.read", "events.write",
    "finance.read",
    "reports.read",
    "tenant.manage",
  ],
  tenant_admin: [
    "members.read", "members.write", "members.delete",
    "events.read", "events.write",
    "finance.read", "finance.write", "finance.approve",
    "reports.read", "settings.read", "settings.write",
  ],
  manager: [
    "members.read", "members.write",
    "events.read", "events.write",
    "reports.read",
  ],
  leader: [
    "members.read",
    "events.read",
  ],
  member: [
    "members.read",
    "events.read",
  ],
  viewer: [
    "members.read",
  ],
};

export function getPermissionsForRole(role: string): string[] {
  return ROLE_PERMISSIONS[role] || [];
}

export interface LegacyTenantContext {
  tenantId: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  user: AuthUser & {
    role: string;
    permissions: string[];
  };
  subscription?: {
    plan: string;
    status: string;
  };
}

export async function getTenantContext(
  request: Request,
  db: any
): Promise<LegacyTenantContext | null> {
  // Extract tenant ID from headers
  const tenantId = request.headers.get("X-Tenant-ID");
  if (!tenantId) return null;

  // Extract user from JWT (simplified - use proper JWT verification in production)
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) return null;

  // In production, verify JWT and extract user
  // For now, return a mock context
  return {
    tenantId,
    tenant: {
      id: tenantId,
      name: "Tenant",
      slug: "tenant",
    },
    user: {
      id: "user-id",
      email: "user@example.com",
      role: "tenant_admin",
      permissions: getPermissionsForRole("tenant_admin"),
    },
  };
}

export function checkPermission(
  context: LegacyTenantContext,
  permission: string
): boolean {
  // Platform owners have all permissions
  if (context.user.role === "platform_owner") return true;

  // Check if user has the required permission
  return context.user.permissions.includes(permission);
}
