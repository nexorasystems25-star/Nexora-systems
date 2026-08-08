import { eq, and, or } from "drizzle-orm";
import { getDb } from "../db";
import {
  identities,
  memberships,
  organizations,
  subscriptions,
  cfUsers,
  platformOwners,
  type Identity,
  type Membership,
  type Organization,
} from "../db/schema-platform";

// ============================================================================
// NEXORA PLATFORM: 4-Level Auth Hierarchy
// ============================================================================
//
// Level 1: Platform Owner (verified via platform_owners table)
//   - Full platform access across all tenants
//   - Can manage products, tenants, billing, support
//   - Can impersonate any user for support
//   - MFA required
//
// Level 2: Nexora Staff
//   - Manage assigned clients/tenants
//   - Handle billing, support tickets
//   - View platform analytics
//   - Cannot access tenant data directly
//
// Level 3: Client Users (Tenant-scoped)
//   - Admin: Full tenant access, user management
//   - Manager: Module management, reporting
//   - Leader: Limited admin, team management
//   - Member: Read-only, self-service
//
// Level 4: Public
//   - Registration, login, password reset
//   - No authenticated access
// ============================================================================

// Auth levels
export const AuthLevel = {
  PLATFORM_OWNER: 1,
  NEXORA_STAFF: 2,
  CLIENT_USER: 3,
  PUBLIC: 4,
} as const;

export type AuthLevel = (typeof AuthLevel)[keyof typeof AuthLevel];

// Platform roles (Level 1-2)
export type PlatformRole =
  | "platform_owner"
  | "platform_admin"
  | "platform_staff"
  | "support_agent"
  | "billing_admin";

// Client roles (Level 3)
export type ClientRole =
  | "tenant_admin"
  | "tenant_manager"
  | "tenant_leader"
  | "tenant_member"
  | "tenant_viewonly";

// Scope types
export type ScopeType = "platform" | "staff" | "tenant" | "self";

// Resolved user context
export interface PlatformUser {
  // Identity
  identityId: string;
  authUserId: string;
  email: string;
  fullName: string;
  status: string;
  mfaRequired: boolean;

  // Auth level
  authLevel: AuthLevel;

  // Membership (for platform/staff users)
  membershipId?: string;
  platformRole?: PlatformRole;
  scope?: ScopeType;

  // Tenant context (for client users)
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  clientRole?: ClientRole;
  productId?: string;

  // Capabilities
  permissions: string[];
  isPlatformUser: boolean;
  isTenantAdmin: boolean;
  isStaffUser: boolean;
}

// Permission strings
export const Permissions = {
  // Platform permissions (Level 1-2)
  PLATFORM_MANAGE: "platform:manage",
  PLATFORM_READ: "platform:read",
  TENANTS_MANAGE: "tenants:manage",
  TENANTS_READ: "tenants:read",
  BILLING_MANAGE: "billing:manage",
  BILLING_READ: "billing:read",
  SUPPORT_MANAGE: "support:manage",
  SUPPORT_READ: "support:read",
  STAFF_MANAGE: "staff:manage",
  AUDIT_READ: "audit:read",

  // Tenant permissions (Level 3)
  TENANT_ADMIN: "tenant:admin",
  TENANT_MANAGE: "tenant:manage",
  TENANT_READ: "tenant:read",
  TENANT_REPORTS: "tenant:reports",

  // Module permissions (ChurchFlow)
  MEMBERS_READ: "members:read",
  MEMBERS_WRITE: "members:write",
  MEMBERS_DELETE: "members:delete",
  FINANCE_READ: "finance:read",
  FINANCE_WRITE: "finance:write",
  FINANCE_APPROVE: "finance:approve",
  ATTENDANCE_READ: "attendance:read",
  ATTENDANCE_WRITE: "attendance:write",
  EVENTS_READ: "events:read",
  EVENTS_WRITE: "events:write",
  VOLUNTEERS_READ: "volunteers:read",
  VOLUNTEERS_WRITE: "volunteers:write",
  CARE_READ: "care:read",
  CARE_WRITE: "care:write",
  PAYROLL_READ: "payroll:read",
  PAYROLL_WRITE: "payroll:write",
  REPORTS_READ: "reports:read",
  REPORTS_EXPORT: "reports:export",
  SETTINGS_READ: "settings:read",
  SETTINGS_WRITE: "settings:write",
} as const;

// Role permission mappings
const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, string[]> = {
  platform_owner: Object.values(Permissions),
  platform_admin: [
    Permissions.PLATFORM_READ,
    Permissions.TENANTS_MANAGE,
    Permissions.TENANTS_READ,
    Permissions.BILLING_MANAGE,
    Permissions.BILLING_READ,
    Permissions.SUPPORT_MANAGE,
    Permissions.SUPPORT_READ,
    Permissions.STAFF_MANAGE,
    Permissions.AUDIT_READ,
  ],
  platform_staff: [
    Permissions.PLATFORM_READ,
    Permissions.TENANTS_READ,
    Permissions.SUPPORT_MANAGE,
    Permissions.SUPPORT_READ,
    Permissions.BILLING_READ,
  ],
  support_agent: [
    Permissions.PLATFORM_READ,
    Permissions.TENANTS_READ,
    Permissions.SUPPORT_MANAGE,
    Permissions.SUPPORT_READ,
  ],
  billing_admin: [
    Permissions.PLATFORM_READ,
    Permissions.TENANTS_READ,
    Permissions.BILLING_MANAGE,
    Permissions.BILLING_READ,
  ],
};

const CLIENT_ROLE_PERMISSIONS: Record<ClientRole, string[]> = {
  tenant_admin: [
    Permissions.TENANT_ADMIN,
    Permissions.TENANT_MANAGE,
    Permissions.TENANT_READ,
    Permissions.TENANT_REPORTS,
    Permissions.MEMBERS_READ,
    Permissions.MEMBERS_WRITE,
    Permissions.MEMBERS_DELETE,
    Permissions.FINANCE_READ,
    Permissions.FINANCE_WRITE,
    Permissions.FINANCE_APPROVE,
    Permissions.ATTENDANCE_READ,
    Permissions.ATTENDANCE_WRITE,
    Permissions.EVENTS_READ,
    Permissions.EVENTS_WRITE,
    Permissions.VOLUNTEERS_READ,
    Permissions.VOLUNTEERS_WRITE,
    Permissions.CARE_READ,
    Permissions.CARE_WRITE,
    Permissions.PAYROLL_READ,
    Permissions.PAYROLL_WRITE,
    Permissions.REPORTS_READ,
    Permissions.REPORTS_EXPORT,
    Permissions.SETTINGS_READ,
    Permissions.SETTINGS_WRITE,
  ],
  tenant_manager: [
    Permissions.TENANT_MANAGE,
    Permissions.TENANT_READ,
    Permissions.TENANT_REPORTS,
    Permissions.MEMBERS_READ,
    Permissions.MEMBERS_WRITE,
    Permissions.FINANCE_READ,
    Permissions.FINANCE_WRITE,
    Permissions.ATTENDANCE_READ,
    Permissions.ATTENDANCE_WRITE,
    Permissions.EVENTS_READ,
    Permissions.EVENTS_WRITE,
    Permissions.VOLUNTEERS_READ,
    Permissions.VOLUNTEERS_WRITE,
    Permissions.CARE_READ,
    Permissions.CARE_WRITE,
    Permissions.PAYROLL_READ,
    Permissions.REPORTS_READ,
    Permissions.REPORTS_EXPORT,
    Permissions.SETTINGS_READ,
  ],
  tenant_leader: [
    Permissions.TENANT_READ,
    Permissions.MEMBERS_READ,
    Permissions.MEMBERS_WRITE,
    Permissions.ATTENDANCE_READ,
    Permissions.ATTENDANCE_WRITE,
    Permissions.EVENTS_READ,
    Permissions.EVENTS_WRITE,
    Permissions.VOLUNTEERS_READ,
    Permissions.VOLUNTEERS_WRITE,
    Permissions.CARE_READ,
    Permissions.CARE_WRITE,
    Permissions.REPORTS_READ,
  ],
  tenant_member: [
    Permissions.TENANT_READ,
    Permissions.MEMBERS_READ,
    Permissions.ATTENDANCE_READ,
    Permissions.EVENTS_READ,
    Permissions.VOLUNTEERS_READ,
    Permissions.CARE_READ,
    Permissions.REPORTS_READ,
  ],
  tenant_viewonly: [
    Permissions.TENANT_READ,
    Permissions.MEMBERS_READ,
    Permissions.REPORTS_READ,
  ],
};

// ============================================================================
// AUTH RESOLUTION FUNCTIONS
// ============================================================================

/**
 * Resolve the authenticated user from a request.
 * Supports: Supabase JWT, mobile token, platform owner fallback.
 */
export async function resolvePlatformUser(
  request: Request
): Promise<PlatformUser | null> {
  const authorization = request.headers.get("authorization")?.trim();

  // Try Supabase JWT first
  if (authorization?.startsWith("Bearer ")) {
    const supabaseUser = await resolveSupabaseUser(authorization);
    if (supabaseUser) return supabaseUser;
  }

  // Try mobile token
  if (authorization?.startsWith("Bearer cfm_")) {
    const mobileUser = await resolveMobileUser(authorization);
    if (mobileUser) return mobileUser;
  }

  // Platform owner fallback for local preview
  const url = new URL(request.url);
  const isLocalPreview =
    url.hostname === "terminal.local" || url.hostname === "localhost";
  if (isLocalPreview) {
    return resolvePlatformOwnerFallback();
  }

  return null;
}

/**
 * Tenant-scoped user type for routes that require tenant context.
 */
export type TenantUser = PlatformUser & {
  tenantId: string;
  role: string;
};

/**
 * Resolve a tenant-scoped user from a request.
 * Returns null if user doesn't have tenant context.
 */
export async function resolveTenantUser(
  request: Request
): Promise<TenantUser | null> {
  const user = await resolvePlatformUser(request);
  if (!user) return null;

  // User must have tenant context
  if (!user.tenantId) return null;

  // Determine the role for tenant context
  const role = user.clientRole || user.platformRole || "tenant_viewonly";

  return {
    ...user,
    tenantId: user.tenantId,
    role,
  };
}

/**
 * Resolve user from Supabase JWT token.
 */
async function resolveSupabaseUser(
  authorization: string
): Promise<PlatformUser | null> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  // Verify token with Supabase
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey, authorization },
  });
  if (!response.ok) return null;

  const authUser = (await response.json()) as {
    id: string;
    email?: string;
  };
  const authUserId = authUser.id;
  const email = authUser.email?.trim().toLowerCase();
  if (!email) return null;

  const db = await getDb();

  // Look up identity
  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.authUserId, authUserId))
    .limit(1);

  if (!identity) {
    // First login - create identity and link to platform owner if email matches
    return createIdentityOnFirstLogin(authUserId, email);
  }

  if (identity.status !== "active") return null;

  // Get memberships
  const userMemberships = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.identityId, identity.id),
        eq(memberships.status, "active")
      )
    );

  // Determine auth level and role
  return buildPlatformUser(identity, userMemberships);
}

/**
 * Resolve user from mobile token (cfm_*).
 */
async function resolveMobileUser(
  authorization: string
): Promise<PlatformUser | null> {
  const rawToken = authorization.slice(7);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawToken)
  );
  const tokenHash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const db = await getDb();

  // Find device
  const [device] = await db
    .select()
    .from(cfMobileDevices)
    .where(eq(cfMobileDevices.tokenHash, tokenHash))
    .limit(1);

  if (!device) return null;
  if (device.status !== "Active") return null;
  if (new Date(device.expiresAt).getTime() <= Date.now()) return null;

  // Get user
  const [cfUser] = await db
    .select()
    .from(cfUsers)
    .where(eq(cfUsers.id, device.userId))
    .limit(1);

  if (!cfUser || cfUser.status !== "Active") return null;

  // Update last used
  await db
    .update(cfMobileDevices)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(cfMobileDevices.id, device.id));

  // Get identity if linked
  if (!cfUser.identityId) return null;

  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.id, cfUser.identityId))
    .limit(1);

  if (!identity) return null;

  // Get memberships
  const userMemberships = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.identityId, identity.id),
        eq(memberships.status, "active")
      )
    );

  return buildPlatformUser(identity, userMemberships, cfUser.tenantId);
}

/**
 * Create identity on first Supabase login.
 */
async function createIdentityOnFirstLogin(
  authUserId: string,
  email: string
): Promise<PlatformUser | null> {
  const db = await getDb();

  // Check if email is a verified platform owner
  const [ownerRecord] = await db
    .select()
    .from(platformOwners)
    .where(eq(platformOwners.email, email.toLowerCase()))
    .limit(1);

  const isOwner = ownerRecord?.status === "active";

  // Create identity
  const [identity] = await db
    .insert(identities)
    .values({
      authUserId,
      email,
      fullName: email
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      status: "active",
      mfaRequired: isOwner,
    })
    .returning();

  if (!identity) return null;

  // If platform owner, create platform membership
  if (isOwner) {
    await db.insert(memberships).values({
      identityId: identity.id,
      role: "platform_owner",
      scope: "platform",
      status: "active",
      permissions: PLATFORM_ROLE_PERMISSIONS.platform_owner,
    });
  }

  // Refresh memberships
  const userMemberships = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.identityId, identity.id),
        eq(memberships.status, "active")
      )
    );

  return buildPlatformUser(identity, userMemberships);
}

/**
 * Platform owner fallback for local preview.
 * Only works if the owner email is in the platform_owners table.
 */
async function resolvePlatformOwnerFallback(): Promise<PlatformUser | null> {
  const db = await getDb();

  // Find any active platform owner in the database
  const [ownerRecord] = await db
    .select()
    .from(platformOwners)
    .where(eq(platformOwners.status, "active"))
    .limit(1);

  if (!ownerRecord) return null;

  const email = ownerRecord.email;

  // Get or create identity
  let [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.email, email))
    .limit(1);

  if (!identity) {
    [identity] = await db
      .insert(identities)
      .values({
        authUserId: crypto.randomUUID(),
        email,
        fullName: "Nexora Platform Owner",
        status: "active",
        mfaRequired: true,
      })
      .returning();

    if (identity) {
      await db.insert(memberships).values({
        identityId: identity.id,
        role: "platform_owner",
        scope: "platform",
        status: "active",
        permissions: PLATFORM_ROLE_PERMISSIONS.platform_owner,
      });
    }
  }

  if (!identity) return null;

  const userMemberships = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.identityId, identity.id),
        eq(memberships.status, "active")
      )
    );

  return buildPlatformUser(identity, userMemberships);
}

/**
 * Build PlatformUser from identity and memberships.
 */
function buildPlatformUser(
  identity: Identity,
  userMemberships: Membership[],
  defaultTenantId?: string
): PlatformUser {
  // Determine auth level
  let authLevel: AuthLevel = AuthLevel.PUBLIC;
  let platformRole: PlatformRole | undefined;
  let clientRole: ClientRole | undefined;
  let tenantId = defaultTenantId;
  let tenantSlug: string | undefined;
  let tenantName: string | undefined;
  let scope: ScopeType | undefined;
  let productId: string | undefined;

  // Collect all permissions
  const allPermissions = new Set<string>();

  // Check for platform/staff membership
  const platformMembership = userMemberships.find(
    (m) => m.scope === "platform" || m.scope === "staff"
  );

  if (platformMembership) {
    authLevel =
      platformMembership.role === "platform_owner"
        ? AuthLevel.PLATFORM_OWNER
        : AuthLevel.NEXORA_STAFF;
    platformRole = platformMembership.role as PlatformRole;
    scope = platformMembership.scope as ScopeType;

    // Add platform permissions
    const perms = PLATFORM_ROLE_PERMISSIONS[platformRole] || [];
    perms.forEach((p) => allPermissions.add(p));
  }

  // Check for tenant membership
  const tenantMembership = userMemberships.find(
    (m) => m.scope === "tenant" && m.organizationId
  );

  if (tenantMembership) {
    authLevel = AuthLevel.CLIENT_USER;
    clientRole = tenantMembership.role as ClientRole;
    tenantId = tenantMembership.organizationId || tenantId;
    scope = "tenant";
    productId = tenantMembership.productId || undefined;

    // Add client permissions
    const perms = CLIENT_ROLE_PERMISSIONS[clientRole] || [];
    perms.forEach((p) => allPermissions.add(p));
  }

  // If no memberships found, still allow basic access
  if (userMemberships.length === 0) {
    authLevel = AuthLevel.CLIENT_USER;
    clientRole = "tenant_viewonly";
    scope = "self";
  }

  return {
    identityId: identity.id,
    authUserId: identity.authUserId,
    email: identity.email,
    fullName: identity.fullName,
    status: identity.status,
    mfaRequired: identity.mfaRequired,
    authLevel,
    membershipId: platformMembership?.id || tenantMembership?.id,
    platformRole,
    scope,
    tenantId,
    tenantSlug,
    tenantName,
    clientRole,
    productId,
    permissions: Array.from(allPermissions),
    isPlatformUser: authLevel <= AuthLevel.NEXORA_STAFF,
    isTenantAdmin: clientRole === "tenant_admin",
    isStaffUser: authLevel === AuthLevel.NEXORA_STAFF,
  };
}

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

/**
 * Check if user has a specific permission.
 */
export function hasPermission(user: PlatformUser, permission: string): boolean {
  // Platform owners have all permissions
  if (user.authLevel === AuthLevel.PLATFORM_OWNER) return true;

  return user.permissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions.
 */
export function hasAnyPermission(
  user: PlatformUser,
  permissions: string[]
): boolean {
  if (user.authLevel === AuthLevel.PLATFORM_OWNER) return true;
  return permissions.some((p) => user.permissions.includes(p));
}

/**
 * Check if user has all specified permissions.
 */
export function hasAllPermissions(
  user: PlatformUser,
  permissions: string[]
): boolean {
  if (user.authLevel === AuthLevel.PLATFORM_OWNER) return true;
  return permissions.every((p) => user.permissions.includes(p));
}

/**
 * Check if user can access a specific tenant.
 */
export function canAccessTenant(
  user: PlatformUser,
  tenantId: string
): boolean {
  // Platform users can access all tenants
  if (user.isPlatformUser) return true;

  // Client users can only access their own tenant
  return user.tenantId === tenantId;
}

/**
 * Require a specific permission or return error response.
 */
export async function requirePermission(
  request: Request,
  permission: string
): Promise<{
  user: PlatformUser | null;
  response: Response | null;
}> {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const user = await resolvePlatformUser(request);

  if (!user) {
    return {
      user: null,
      response: Response.json(
        { error: "Authentication required", requestId },
        { status: 401 }
      ),
    };
  }

  if (!hasPermission(user, permission)) {
    return {
      user,
      response: Response.json(
        {
          error: "Insufficient permissions",
          required: permission,
          requestId,
        },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}

/**
 * Require tenant access or return error response.
 */
export async function requireTenantAccess(
  request: Request,
  tenantId: string
): Promise<{
  user: PlatformUser | null;
  response: Response | null;
}> {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const user = await resolvePlatformUser(request);

  if (!user) {
    return {
      user: null,
      response: Response.json(
        { error: "Authentication required", requestId },
        { status: 401 }
      ),
    };
  }

  if (!canAccessTenant(user, tenantId)) {
    return {
      user,
      response: Response.json(
        {
          error: "Access denied to this tenant",
          requestId,
        },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get tenant ID from user context.
 */
export function getTenantId(user: PlatformUser): string | null {
  return user.tenantId || null;
}

/**
 * Check if user is platform owner.
 */
export function isPlatformOwner(user: PlatformUser): boolean {
  return user.authLevel === AuthLevel.PLATFORM_OWNER;
}

/**
 * Check if user is staff or above.
 */
export function isStaffOrAbove(user: PlatformUser): boolean {
  return user.authLevel <= AuthLevel.NEXORA_STAFF;
}

/**
 * Get user's display role label.
 */
export function getRoleLabel(user: PlatformUser): string {
  if (user.platformRole) {
    return user.platformRole
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }
  if (user.clientRole) {
    return user.clientRole
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }
  return "User";
}
