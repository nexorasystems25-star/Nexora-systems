import { type Request as NextRequest } from "next/server";
import { getDb } from "../../db";
import {
  organizations,
  memberships,
  subscriptions,
  products,
  identities,
} from "../../db/schema-platform";
import { eq, and, desc } from "drizzle-orm";
import { apiJson } from "./_security";

// ============================================================================
// TENANT COMPATIBILITY LAYER
// ============================================================================
// Adds tenant scoping to existing routes with minimal changes
// ============================================================================

export interface TenantContext {
  tenantId: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  user: {
    identityId: string;
    email: string;
    role: string;
    isPlatformUser: boolean;
  };
  subscription?: {
    plan: string;
    status: string;
  };
}

/**
 * Extract tenant ID from request headers or query params.
 */
export function extractTenantId(request: Request): string | null {
  // Check X-Tenant-ID header (from tenant switcher)
  const headerTenantId = request.headers.get("X-Tenant-ID");
  if (headerTenantId) return headerTenantId;

  // Check query param
  const url = new URL(request.url);
  const queryTenantId = url.searchParams.get("tenant_id");
  if (queryTenantId) return queryTenantId;

  // Check cookie (for SSR)
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "selected_tenant_id" && value) return value;
    }
  }

  return null;
}

/**
 * Resolve tenant context from request.
 * Returns null if no tenant context available (falls back to legacy auth).
 */
export async function resolveTenantContext(
  request: Request
): Promise<TenantContext | null> {
  const tenantId = extractTenantId(request);
  if (!tenantId) return null;

  try {
    const db = await getDb();

    // Get tenant
    const [tenant] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
      })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    if (!tenant) return null;

    // Get user from auth header
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    // Try to resolve user identity
    let user: TenantContext["user"] | null = null;

    if (token) {
      // In production, decode JWT here
      // For now, check if token matches a known pattern
      const [identity] = await db
        .select({
          id: identities.id,
          email: identities.email,
        })
        .from(identities)
        .where(eq(identities.email, token)) // Simplified - use JWT decode in production
        .limit(1);

      if (identity) {
        // Get membership
        const [membership] = await db
          .select({
            role: memberships.role,
          })
          .from(memberships)
          .where(
            and(
              eq(memberships.identityId, identity.id),
              eq(memberships.organizationId, tenantId),
              eq(memberships.status, "active")
            )
          )
          .limit(1);

        if (membership) {
          user = {
            identityId: identity.id,
            email: identity.email,
            role: membership.role,
            isPlatformUser: false,
          };
        }
      }
    }

    // Get subscription info
    const [subscription] = await db
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
      })
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, tenantId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    return {
      tenantId,
      tenant,
      user: user || {
        identityId: "unknown",
        email: "unknown",
        role: "member",
        isPlatformUser: false,
      },
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
          }
        : undefined,
    };
  } catch (error) {
    console.error("Failed to resolve tenant context:", error);
    return null;
  }
}

/**
 * Check if user has permission for tenant.
 * Returns true if authorized, false otherwise.
 */
export async function checkTenantPermission(
  tenantContext: TenantContext,
  permission: string
): Promise<boolean> {
  // Platform users have all permissions
  if (tenantContext.user.isPlatformUser) return true;

  // Define role permissions
  const rolePermissions: Record<string, string[]> = {
    owner: [
      "members.read",
      "members.write",
      "events.read",
      "events.write",
      "finance.read",
      "finance.write",
      "finance.approve",
      "attendance.read",
      "attendance.manage",
      "reports.read",
      "settings.read",
      "settings.write",
    ],
    tenant_admin: [
      "members.read",
      "members.write",
      "events.read",
      "events.write",
      "finance.read",
      "finance.write",
      "attendance.read",
      "attendance.manage",
      "reports.read",
      "settings.read",
    ],
    client_admin: [
      "members.read",
      "members.write",
      "events.read",
      "events.write",
      "finance.read",
      "attendance.read",
      "attendance.manage",
      "reports.read",
    ],
    admin: [
      "members.read",
      "members.write",
      "events.read",
      "events.write",
      "finance.read",
      "attendance.read",
      "attendance.manage",
    ],
    manager: [
      "members.read",
      "members.write",
      "events.read",
      "events.write",
      "attendance.read",
      "attendance.manage",
    ],
    leader: ["members.read", "events.read", "attendance.read"],
    member: ["members.read", "events.read"],
    viewer: ["members.read"],
  };

  const permissions = rolePermissions[tenantContext.user.role] || [];
  return permissions.includes(permission);
}

/**
 * Add tenant_id to database queries.
 * Use this to scope queries to the current tenant.
 */
export function withTenantScope(
  conditions: any[],
  tenantId: string,
  table?: any
): any[] {
  if (!table) return conditions;

  // Add tenant_id condition if the table has it
  if (table.tenantId) {
    return [...conditions, eq(table.tenantId, tenantId)];
  }

  return conditions;
}

/**
 * Wrap existing route handler with tenant context.
 * Usage: export const GET = withTenantContext(originalGET);
 */
export function withTenantContext(
  handler: (
    request: Request,
    context?: { tenant?: TenantContext }
  ) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    const tenantContext = await resolveTenantContext(request);

    // If no tenant context, fall through to original handler
    if (!tenantContext) {
      return handler(request);
    }

    // Check if route requires tenant context
    const url = new URL(request.url);
    const requiresTenant = url.searchParams.get("require_tenant") === "true";

    if (requiresTenant && !tenantContext.tenantId) {
      return apiJson(
        { error: "Tenant context required" },
        400,
        crypto.randomUUID()
      );
    }

    // Pass tenant context to handler
    return handler(request, { tenant: tenantContext });
  };
}
