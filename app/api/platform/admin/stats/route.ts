import { eq, count, sql, desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  organizations,
  memberships,
  subscriptions,
  products,
  identities,
} from "../../../../db/schema-platform";
import { resolvePlatformUser, type PlatformUser } from "../../../../lib/auth-platform";
import { apiJson, getRequestId, ApiError } from "../../../_security";

// ============================================================================
// PLATFORM ADMIN STATS API
// ============================================================================
// Provides platform-wide statistics for Nexora staff
// ============================================================================

// GET /api/platform/admin/stats - Get platform statistics
export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await resolvePlatformUser(request);

    if (!user?.isPlatformUser) {
      throw new ApiError(403, "Platform access required");
    }

    const db = await getDb();

    // Total organizations
    const [orgCount] = await db
      .select({ count: count() })
      .from(organizations);

    // Active organizations
    const [activeOrgs] = await db
      .select({ count: count() })
      .from(organizations)
      .where(eq(organizations.status, "active"));

    // Total users
    const [userCount] = await db
      .select({ count: count() })
      .from(identities);

    // Total members
    const [memberCount] = await db
      .select({ count: count() })
      .from(memberships)
      .where(eq(memberships.status, "active"));

    // Subscriptions by status
    const subscriptionsByStatus = await db
      .select({
        status: subscriptions.status,
        count: count(),
      })
      .from(subscriptions)
      .groupBy(subscriptions.status);

    // Subscriptions by plan
    const subscriptionsByPlan = await db
      .select({
        plan: subscriptions.plan,
        count: count(),
      })
      .from(subscriptions)
      .groupBy(subscriptions.plan);

    // Total MRR (Monthly Recurring Revenue)
    const [mrr] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${subscriptions.monthlyAmount}), 0)`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"));

    // Recent organizations
    const recentOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        lifecycle: organizations.lifecycle,
        status: organizations.status,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .orderBy(desc(organizations.createdAt))
      .limit(5);

    // Organizations by sector
    const orgsBySector = await db
      .select({
        sector: organizations.sector,
        count: count(),
      })
      .from(organizations)
      .groupBy(organizations.sector);

    return apiJson(
      {
        overview: {
          totalOrganizations: orgCount?.count || 0,
          activeOrganizations: activeOrgs?.count || 0,
          totalUsers: userCount?.count || 0,
          totalMembers: memberCount?.count || 0,
        },
        revenue: {
          mrr: mrr?.total || 0,
          mrrDisplay: formatCurrency(mrr?.total || 0),
        },
        subscriptions: {
          byStatus: subscriptionsByStatus.reduce(
            (acc, row) => ({ ...acc, [row.status]: row.count }),
            {} as Record<string, number>
          ),
          byPlan: subscriptionsByPlan.reduce(
            (acc, row) => ({ ...acc, [row.plan]: row.count }),
            {} as Record<string, number>
          ),
        },
        organizations: {
          recent: recentOrgs.map((org) => ({
            id: org.id,
            name: org.name,
            slug: org.slug,
            lifecycle: org.lifecycle,
            status: org.status,
            createdAt: org.createdAt,
          })),
          bySector: orgsBySector.reduce(
            (acc, row) => ({ ...acc, [row.sector || "unknown"]: row.count }),
            {} as Record<string, number>
          ),
        },
      },
      200,
      requestId
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return apiJson({ error: error.publicMessage }, error.status, requestId);
    }
    console.error("Failed to fetch platform stats:", error);
    return apiJson({ error: "Failed to fetch platform stats" }, 500, requestId);
  }
}

function formatCurrency(amount: number): string {
  // Amount stored in pesewas (1/100 GHS)
  const ghs = amount / 100;
  return `GH₵${ghs.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
}
