import type { TenantContext, AuthUser } from "./types";

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

export async function getTenantContext(
  request: Request,
  db: any
): Promise<TenantContext | null> {
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
  context: TenantContext,
  permission: string
): boolean {
  // Platform owners have all permissions
  if (context.user.role === "platform_owner") return true;

  // Check if user has the required permission
  return context.user.permissions.includes(permission);
}
