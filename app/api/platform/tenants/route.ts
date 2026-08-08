import { eq, and } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  organizations,
  memberships,
  subscriptions,
  products,
} from "../../../../db/schema-platform";
import { resolvePlatformUser } from "../../../../lib/auth-platform";
import { apiJson, getRequestId } from "../../_security";

// ============================================================================
// PLATFORM TENANTS API
// ============================================================================
// Returns tenants (organizations) the current user has access to
// ============================================================================

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    // Resolve user
    const user = await resolvePlatformUser(request);
    if (!user) {
      return apiJson({ error: "Authentication required" }, 401, requestId);
    }

    const db = await getDb();
    let tenants: any[] = [];

    if (user.isPlatformUser) {
      // Platform users see all tenants
      const orgs = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          lifecycle: organizations.lifecycle,
          status: organizations.status,
        })
        .from(organizations);

      // Get subscriptions for each org
      tenants = await Promise.all(
        orgs.map(async (org) => {
          const [sub] = await db
            .select({
              plan: subscriptions.plan,
              status: subscriptions.status,
              renewalAt: subscriptions.renewalAt,
              productName: products.name,
              productSlug: products.slug,
            })
            .from(subscriptions)
            .leftJoin(products, eq(subscriptions.productId, products.id))
            .where(eq(subscriptions.organizationId, org.id))
            .limit(1);

          return {
            ...org,
            lifecycle: org.lifecycle,
            product: sub
              ? { name: sub.productName, slug: sub.productSlug }
              : undefined,
            subscription: sub
              ? {
                  plan: sub.plan,
                  status: sub.status,
                  renewalAt: sub.renewalAt,
                }
              : undefined,
          };
        })
      );
    } else {
      // Client users see only their tenant(s)
      const userMemberships = await db
        .select({
          organizationId: memberships.organizationId,
          role: memberships.role,
          scope: memberships.scope,
        })
        .from(memberships)
        .where(
          and(
            eq(memberships.identityId, user.identityId),
            eq(memberships.status, "active")
          )
        );

      // Get org details for each membership
      const orgIds = userMemberships
        .filter((m) => m.organizationId)
        .map((m) => m.organizationId!);

      if (orgIds.length > 0) {
        const orgs = await db
          .select({
            id: organizations.id,
            name: organizations.name,
            slug: organizations.slug,
            lifecycle: organizations.lifecycle,
            status: organizations.status,
          })
          .from(organizations)
          .where(eq(organizations.id, orgIds[0])); // Simplified - should handle all orgIds

        // Get subscriptions
        tenants = await Promise.all(
          orgs.map(async (org) => {
            const [sub] = await db
              .select({
                plan: subscriptions.plan,
                status: subscriptions.status,
                renewalAt: subscriptions.renewalAt,
                productName: products.name,
                productSlug: products.slug,
              })
              .from(subscriptions)
              .leftJoin(products, eq(subscriptions.productId, products.id))
              .where(eq(subscriptions.organizationId, org.id))
              .limit(1);

            const membership = userMemberships.find(
              (m) => m.organizationId === org.id
            );

            return {
              ...org,
              lifecycle: org.lifecycle,
              role: membership?.role,
              product: sub
                ? { name: sub.productName, slug: sub.productSlug }
                : undefined,
              subscription: sub
                ? {
                    plan: sub.plan,
                    status: sub.status,
                    renewalAt: sub.renewalAt,
                  }
                : undefined,
            };
          })
        );
      }
    }

    return apiJson({ tenants }, 200, requestId);
  } catch (error) {
    console.error("Failed to load tenants:", error);
    return apiJson({ error: "Failed to load tenants" }, 500, requestId);
  }
}
