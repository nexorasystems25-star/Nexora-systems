import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  subscriptions,
  invoices,
  organizations,
  products,
  auditEvents,
} from "../../../db/schema-platform";
import {
  resolveTenantUser,
  type TenantUser,
} from "../../../lib/auth-platform";
import { apiJson, getRequestId, readJson, ApiError } from "../../_security";

// ============================================================================
// BILLING API
// ============================================================================
// Manages subscriptions, invoices, and billing operations
// ============================================================================

// GET /api/platform/billing - Get current subscription and billing info
export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await resolveTenantUser(request);

    if (!user) {
      throw new ApiError(401, "Authentication required");
    }

    // Must have billing access
    if (!["tenant_admin", "client_admin", "owner"].includes(user.role)) {
      throw new ApiError(403, "Insufficient permissions");
    }

    const db = await getDb();

    // Get current subscription with product info
    const [subscription] = await db
      .select({
        id: subscriptions.id,
        plan: subscriptions.plan,
        status: subscriptions.status,
        monthlyAmount: subscriptions.monthlyAmount,
        currency: subscriptions.currency,
        trialEndsAt: subscriptions.trialEndsAt,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAt: subscriptions.cancelAt,
        cancelledAt: subscriptions.cancelledAt,
        createdAt: subscriptions.createdAt,
        productName: products.name,
        productSlug: products.slug,
      })
      .from(subscriptions)
      .leftJoin(products, eq(subscriptions.productId, products.id))
      .where(eq(subscriptions.organizationId, user.tenantId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (!subscription) {
      throw new ApiError(404, "No active subscription");
    }

    // Get recent invoices
    const recentInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        status: invoices.status,
        totalAmount: invoices.totalAmount,
        currency: invoices.currency,
        issuedAt: invoices.issuedAt,
        dueAt: invoices.dueAt,
        paidAt: invoices.paidAt,
      })
      .from(invoices)
      .where(eq(invoices.subscriptionId, subscription.id))
      .orderBy(desc(invoices.issuedAt))
      .limit(5);

    // Calculate billing summary
    const daysUntilRenewal = subscription.currentPeriodEnd
      ? Math.ceil(
          (new Date(subscription.currentPeriodEnd).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

    const isTrial =
      subscription.status === "trialing" &&
      subscription.trialEndsAt &&
      new Date(subscription.trialEndsAt) > new Date();

    const trialDaysLeft =
      isTrial && subscription.trialEndsAt
        ? Math.ceil(
            (new Date(subscription.trialEndsAt).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

    return apiJson(
      {
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          monthlyAmount: subscription.monthlyAmount,
          currency: subscription.currency,
          productName: subscription.productName,
          trialEndsAt: subscription.trialEndsAt,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAt: subscription.cancelAt,
          cancelledAt: subscription.cancelledAt,
        },
        summary: {
          isTrial,
          trialDaysLeft,
          daysUntilRenewal,
          monthlyDisplay: formatCurrency(
            subscription.monthlyAmount,
            subscription.currency
          ),
        },
        recentInvoices: recentInvoices.map((inv) => ({
          id: inv.id,
          number: inv.invoiceNumber,
          status: inv.status,
          amount: formatCurrency(inv.totalAmount, inv.currency),
          issuedAt: inv.issuedAt,
          dueAt: inv.dueAt,
          paidAt: inv.paidAt,
        })),
      },
      200,
      requestId
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return apiJson({ error: error.publicMessage }, error.status, requestId);
    }
    console.error("Failed to fetch billing info:", error);
    return apiJson({ error: "Failed to fetch billing info" }, 500, requestId);
  }
}

// POST /api/platform/billing - Update subscription (upgrade/downgrade)
export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await resolveTenantUser(request);

    if (!user) {
      throw new ApiError(401, "Authentication required");
    }

    if (!["tenant_admin", "client_admin", "owner"].includes(user.role)) {
      throw new ApiError(403, "Only administrators can change subscription");
    }

    const payload = await readJson<{ action: string; plan?: string }>(request);

    if (!payload.action) {
      throw new ApiError(400, "Action is required");
    }

    const db = await getDb();

    // Get current subscription
    const [currentSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, user.tenantId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (!currentSub) {
      throw new ApiError(404, "No active subscription");
    }

    let updatedSubscription;

    switch (payload.action) {
      case "upgrade":
      case "downgrade":
        if (!payload.plan) {
          throw new ApiError(400, "Plan is required for upgrade/downgrade");
        }

        const newAmount = getPlanAmount(payload.plan);

        [updatedSubscription] = await db
          .update(subscriptions)
          .set({
            plan: payload.plan,
            monthlyAmount: newAmount,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(subscriptions.id, currentSub.id))
          .returning();

        break;

      case "cancel":
        [updatedSubscription] = await db
          .update(subscriptions)
          .set({
            cancelAt: currentSub.currentPeriodEnd,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(subscriptions.id, currentSub.id))
          .returning();
        break;

      case "reactivate":
        [updatedSubscription] = await db
          .update(subscriptions)
          .set({
            cancelAt: null,
            cancelledAt: null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(subscriptions.id, currentSub.id))
          .returning();
        break;

      default:
        throw new ApiError(400, "Invalid action");
    }

    // Audit log
    await db.insert(auditEvents).values({
      organizationId: user.tenantId,
      actorId: user.identityId,
      actorEmail: user.email,
      action: `billing.${payload.action}`,
      entityType: "subscription",
      entityId: currentSub.id,
      payload: {
        action: payload.action,
        plan: payload.plan || currentSub.plan,
        previousPlan: currentSub.plan,
      },
    });

    return apiJson(
      {
        success: true,
        subscription: {
          id: updatedSubscription?.id,
          plan: updatedSubscription?.plan,
          status: updatedSubscription?.status,
          monthlyAmount: updatedSubscription?.monthlyAmount,
          cancelAt: updatedSubscription?.cancelAt,
        },
      },
      200,
      requestId
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return apiJson({ error: error.publicMessage }, error.status, requestId);
    }
    console.error("Failed to update subscription:", error);
    return apiJson({ error: "Failed to update subscription" }, 500, requestId);
  }
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === "GHS") {
    return `GH₵${(amount / 100).toFixed(2)}`;
  }
  return `${currency} ${(amount / 100).toFixed(2)}`;
}

function getPlanAmount(plan: string): number {
  const amounts: Record<string, number> = {
    starter: 9900,
    professional: 29900,
    enterprise: 59900,
  };
  return amounts[plan] || amounts.professional;
}
