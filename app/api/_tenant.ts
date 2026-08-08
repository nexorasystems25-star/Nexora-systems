import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import {
  resolvePlatformUser,
  requirePermission as requirePlatformPermission,
  hasPermission,
  canAccessTenant,
  getTenantId,
  type PlatformUser,
  Permissions,
} from "../../lib/auth-platform";
import { auditEvents } from "../../db/schema-platform";
import { apiJson, getRequestId, type ApiError } from "./_security";

// ============================================================================
// TENANT-AWARE API MIDDLEWARE
// ============================================================================
//
// This module provides middleware for tenant-scoped API routes.
// All ChurchFlow data is now scoped by tenant_id.
// ============================================================================

export type { PlatformUser };

// Re-export for backwards compatibility
export { requirePlatformPermission as requirePermission };

/**
 * Require tenant access and return tenant context.
 * Use this in all ChurchFlow API routes.
 */
export async function requireTenantContext(request: Request): Promise<
  | {
      user: PlatformUser;
      tenantId: string;
      response: null;
    }
  | {
      user: PlatformUser;
      tenantId: null;
      response: null;
    }
  | {
      user: null;
      tenantId: null;
      response: Response;
    }
> {
  const requestId = getRequestId(request);

  // Resolve user
  const user = await resolvePlatformUser(request);
  if (!user) {
    return {
      user: null,
      tenantId: null,
      response: apiJson(
        { error: "Authentication required", requestId },
        401,
        requestId
      ),
    };
  }

  // Get tenant ID from user context or query params
  let tenantId = getTenantId(user);

  // If no tenant in user context, check query params (for platform users)
  if (!tenantId) {
    const url = new URL(request.url);
    tenantId = url.searchParams.get("tenant_id");

    if (tenantId && !canAccessTenant(user, tenantId)) {
      return {
        user: null,
        tenantId: null,
        response: apiJson(
          { error: "Access denied to this tenant", requestId },
          403,
          requestId
        ),
      };
    }
  }

  // Platform users without tenant context can access platform routes
  if (!tenantId && user.isPlatformUser) {
    return {
      user,
      tenantId: null,
      response: null,
    };
  }

  // Client users must have a tenant
  if (!tenantId && !user.isPlatformUser) {
    return {
      user: null,
      tenantId: null,
      response: apiJson(
        {
          error: "No tenant context. Please select an organization.",
          requestId,
        },
        400,
        requestId
      ),
    };
  }

  return {
    user,
    tenantId: tenantId!,
    response: null,
  };
}

/**
 * Require specific permission with tenant context.
 */
export async function requireTenantPermission(
  request: Request,
  permission: string
): Promise<
  | {
      user: PlatformUser;
      tenantId: string;
      response: null;
    }
  | {
      user: PlatformUser | null;
      tenantId: null;
      response: Response;
    }
> {
  const requestId = getRequestId(request);
  const context = await requireTenantContext(request);

  if (context.response) {
    return { user: context.user, tenantId: null, response: context.response };
  }

  if (!hasPermission(context.user, permission)) {
    return {
      user: context.user,
      tenantId: null,
      response: apiJson(
        {
          error: "Insufficient permissions",
          required: permission,
          requestId,
        },
        403,
        requestId
      ),
    };
  }

  return {
    user: context.user,
    tenantId: context.tenantId,
    response: null,
  };
}

/**
 * Tenant-scoped database query helper.
 * Automatically filters by tenant_id.
 */
export function tenantQuery(db: ReturnType<typeof getDb> extends Promise<infer T> ? T : never) {
  return {
    /**
     * Query with tenant filter.
     */
    where: <T extends { tenantId: any }>(table: T, tenantId: string) => {
      return eq(table.tenantId, tenantId);
    },

    /**
     * Query with tenant and additional conditions.
     */
    whereAnd: <T extends { tenantId: any }>(
      table: T,
      tenantId: string,
      ...conditions: any[]
    ) => {
      return and(eq(table.tenantId, tenantId), ...conditions);
    },
  };
}

/**
 * Write tenant-scoped audit log.
 */
export async function writeTenantAudit(
  tenantId: string,
  user: PlatformUser,
  action: string,
  entityType: string,
  entityId: string,
  detail?: string
): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(auditEvents).values({
      organizationId: tenantId,
      actorId: user.identityId,
      actorEmail: user.email,
      action,
      entityType,
      entityId,
      payload: detail ? { detail } : {},
    });
  } catch (error) {
    console.error("Audit write failed:", error);
  }
}

/**
 * Check if user can perform write operation on tenant.
 */
export function canWriteToTenant(user: PlatformUser, tenantId: string): boolean {
  // Platform users can write to any tenant
  if (user.isPlatformUser) return true;

  // Client users must have write permissions and match tenant
  return (
    user.tenantId === tenantId &&
    hasPermission(user, Permissions.TENANT_MANAGE)
  );
}

/**
 * Check if user can read from tenant.
 */
export function canReadFromTenant(user: PlatformUser, tenantId: string): boolean {
  // Platform users can read from any tenant
  if (user.isPlatformUser) return true;

  // Client users must match tenant
  return user.tenantId === tenantId;
}

/**
 * Get tenant ID from table name (for legacy compatibility).
 * Returns the column name to filter by.
 */
export function getTenantColumn(tableName: string): string {
  return "tenant_id";
}

/**
 * Create tenant-scoped response with pagination.
 */
export function tenantPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  requestId: string
) {
  return apiJson(
    {
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    },
    200,
    requestId
  );
}

/**
 * Extract tenant ID from request (query param or user context).
 */
export function extractTenantId(request: Request, user: PlatformUser): string | null {
  // Try user context first
  const userTenant = getTenantId(user);
  if (userTenant) return userTenant;

  // Try query params
  const url = new URL(request.url);
  return url.searchParams.get("tenant_id");
}

/**
 * Validate tenant ID format (UUID).
 */
export function isValidTenantId(tenantId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    tenantId
  );
}

/**
 * Tenant context for API routes.
 * Use this wrapper for all ChurchFlow API handlers.
 */
export async function withTenantContext<T>(
  request: Request,
  handler: (
    user: PlatformUser,
    tenantId: string,
    requestId: string
  ) => Promise<T>,
  options?: {
    permission?: string;
    requireTenant?: boolean;
  }
): Promise<Response> {
  const requestId = getRequestId(request);

  try {
    // Resolve tenant context
    const context = await requireTenantContext(request);
    if (context.response) return context.response;

    // Check permission if specified
    if (options?.permission && context.user) {
      if (!hasPermission(context.user, options.permission)) {
        return apiJson(
          {
            error: "Insufficient permissions",
            required: options.permission,
            requestId,
          },
          403,
          requestId
        );
      }
    }

    // Require tenant if specified
    if (options?.requireTenant !== false && !context.tenantId && !context.user?.isPlatformUser) {
      return apiJson(
        {
          error: "Tenant context required",
          requestId,
        },
        400,
        requestId
      );
    }

    // Execute handler
    const result = await handler(
      context.user!,
      context.tenantId || "",
      requestId
    );

    return result as Response;
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && "publicMessage" in error) {
      const apiError = error as { status: number; publicMessage: string };
      return apiJson({ error: apiError.publicMessage, requestId }, apiError.status, requestId);
    }
    console.error(JSON.stringify({
      level: "error",
      requestId,
      route: new URL(request.url).pathname,
      method: request.method,
      error: error instanceof Error ? error.name : "UnknownError",
    }));
    return apiJson({ error: "An unexpected error occurred", requestId }, 500, requestId);
  }
}
