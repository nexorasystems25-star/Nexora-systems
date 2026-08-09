export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "offboarding"
  | "terminated";

export const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  trialing: ["active", "canceled"],
  active: ["past_due", "paused", "canceled", "offboarding"],
  past_due: ["active", "canceled", "offboarding"],
  paused: ["active", "canceled"],
  canceled: ["terminated"],
  offboarding: ["terminated"],
  terminated: [],
};

export function canTransition(
  current: SubscriptionStatus,
  target: SubscriptionStatus
): boolean {
  return VALID_TRANSITIONS[current]?.includes(target) ?? false;
}

export function isActive(status: SubscriptionStatus): boolean {
  return ["trialing", "active"].includes(status);
}

export function isSuspended(status: SubscriptionStatus): boolean {
  return ["past_due", "paused"].includes(status);
}

export async function transitionSubscription(
  subscriptionId: string,
  newStatus: SubscriptionStatus,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@repo/database");
    const { subscriptions, auditLog } = await import("@repo/database/schema");

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    const currentStatus = subscription.status as SubscriptionStatus;

    if (!canTransition(currentStatus, newStatus)) {
      return {
        success: false,
        error: `Invalid transition from "${currentStatus}" to "${newStatus}"`,
      };
    }

    await db
      .update(subscriptions)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(subscriptions.id, subscriptionId));

    await db.insert(auditLog).values({
      entityType: "subscription",
      entityId: subscriptionId,
      action: "status_change",
      metadata: {
        from: currentStatus,
        to: newStatus,
        reason: reason ?? null,
      },
      createdAt: new Date(),
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
