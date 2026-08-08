import { eq, and, count, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  organizations,
  memberships,
  subscriptions,
  products,
  audit_events,
} from "../../../db/schema-platform";
import {
  resolveTenantUser,
  type TenantUser,
} from "../../../lib/auth-platform";
import { apiJson, getRequestId, ApiError } from "../../_security";

// ============================================================================
// ANALYTICS API
// ============================================================================
// Provides dashboard analytics and statistics
// ============================================================================

// GET /api/platform/analytics - Get tenant analytics
export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await resolveTenantUser(request);

    if (!user) {
      throw new ApiError(401, "Authentication required");
    }

    const db = await getDb();

    // Get member count
    const [memberCount] = await db
      .select({ count: count() })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, user.tenantId),
          eq(memberships.status, "active")
        )
      );

    // Get subscription info
    const [subscription] = await db
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        monthlyAmount: subscriptions.monthlyAmount,
      })
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, user.tenantId))
      .limit(1);

    // Get organization info
    const [org] = await db
      .select({
        name: organizations.name,
        slug: organizations.slug,
        lifecycle: organizations.lifecycle,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .where(eq(organizations.id, user.tenantId))
      .limit(1);

    // Get recent activity count (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [recentActivity] = await db
      .select({ count: count() })
      .from(audit_events)
      .where(
        and(
          eq(audit_events.organizationId, user.tenantId),
          sql`${audit_events.createdAt} > ${sevenDaysAgo}`
        )
      );

    // Get pending invitations
    const [pendingInvites] = await db
      .select({ count: count() })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, user.tenantId),
          eq(memberships.status, "invited")
        )
      );

    // Calculate days since creation
    const daysSinceCreation = org?.createdAt
      ? Math.floor(
          (Date.now() - new Date(org.createdAt).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    // Check trial status
    const isTrial =
      subscription?.status === "trialing";
    const trialDaysLeft = isTrial ? 14 : null; // Simplified - would calculate from actual trialEndsAt

    return apiJson(
      {
        organization: {
          name: org?.name || "Organization",
          slug: org?.slug || "",
          lifecycle: org?.lifecycle || "active",
          daysSinceCreation,
        },
        stats: {
          totalMembers: memberCount?.count || 0,
          pendingInvites: pendingInvites?.count || 0,
          recentActivity: recentActivity?.count || 0,
        },
        subscription: {
          plan: subscription?.plan || "none",
          status: subscription?.status || "inactive",
          isTrial,
          trialDaysLeft,
          monthlyAmount: subscription?.monthlyAmount || 0,
        },
        quickActions: [
          {
            label: "Add Member",
            href: "/dashboard/members",
            icon: "users",
          },
          {
            label: "View Reports",
            href: "/dashboard/reports",
            icon: "chart",
          },
          {
            label: "Manage Events",
            href: "/dashboard/events",
            icon: "calendar",
          },
          {
            label: "Finance",
            href: "/dashboard/finance",
            icon: "money",
          },
        ],
      },
      200,
      requestId
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return apiJson({ error: error.publicMessage }, error.status, requestId);
    }
    console.error("Failed to fetch analytics:", error);
    return apiJson({ error: "Failed to fetch analytics" }, 500, requestId);
  }
}
