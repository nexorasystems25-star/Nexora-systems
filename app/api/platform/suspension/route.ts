import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { organizations, subscriptions, auditEvents } from "../../../db/schema-platform";
import { transitionSubscription } from "@nexora/billing";
import {
  resolveTenantUser,
} from "../../../lib/auth-platform";
import { apiJson, getRequestId, readJson, ApiError } from "../../_security";

// ============================================================================
// SUSPENSION CONTROL API
// ============================================================================
// Manages subscription suspension and reactivation
// ============================================================================

// POST /api/platform/suspension - Suspend or reactivate a subscription
export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await resolveTenantUser(request);

    if (!user) {
      throw new ApiError(401, "Authentication required");
    }

    // Must have admin access
    if (!["tenant_admin", "client_admin", "owner"].includes(user.role)) {
      throw new ApiError(403, "Insufficient permissions");
    }

    const payload = await readJson<{ organizationId: string; action: string; reason?: string }>(request);

    // Validate action
    if (!["suspend", "reactivate"].includes(payload.action)) {
      throw new ApiError(400, "Invalid action. Must be 'suspend' or 'reactivate'");
    }

    const db = await getDb();

    // Get current subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, payload.organizationId))
      .limit(1);

    if (!subscription) {
      throw new ApiError(404, "Subscription not found");
    }

    // Transition subscription
    const newStatus = payload.action === "suspend" ? "past_due" : "active";
    const result = await transitionSubscription(subscription.id, newStatus, payload.reason);

    if (!result.success) {
      throw new ApiError(400, result.error || "Failed to transition subscription");
    }

    // Update organization status
    await db
      .update(organizations)
      .set({ 
        status: payload.action === "suspend" ? "suspended" : "active",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(organizations.id, payload.organizationId));

    // Log audit event
    await db.insert(auditEvents).values({
      organizationId: payload.organizationId,
      actorId: user.identityId,
      actorEmail: user.email,
      action: `subscription.${payload.action}`,
      entityType: "subscription",
      entityId: subscription.id,
      payload: { 
        reason: payload.reason, 
        newStatus,
        previousStatus: subscription.status,
      },
    });

    return apiJson(
      { 
        success: true, 
        status: newStatus,
        organizationId: payload.organizationId,
      },
      200,
      requestId
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return apiJson({ error: error.publicMessage }, error.status, requestId);
    }
    console.error("Failed to process suspension:", error);
    return apiJson({ error: "Failed to process suspension request" }, 500, requestId);
  }
}
