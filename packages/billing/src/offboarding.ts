export type OffboardingStep =
  | "initiated"
  | "data_exported"
  | "settled"
  | "retained"
  | "deleted"
  | "completed";

export interface OffboardingProgress {
  organizationId: string;
  currentStep: OffboardingStep;
  completedSteps: OffboardingStep[];
  startedAt: Date;
  completedAt?: Date;
}

const STEP_ORDER: OffboardingStep[] = [
  "initiated",
  "data_exported",
  "settled",
  "retained",
  "deleted",
  "completed",
];

export async function initiateOffboarding(
  organizationId: string
): Promise<OffboardingProgress> {
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("../../../db");
  const { organizations, subscriptions, auditEvents } = await import(
    "../../../db/schema-platform"
  );

  const db = await getDb();

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error("Organization not found");
  }

  if (org.lifecycle === "offboarding" || org.lifecycle === "archived") {
    throw new Error("Organization is already being offboarded or archived");
  }

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);

  if (subscription && subscription.status === "active") {
    throw new Error(
      "Active subscription must be canceled before offboarding"
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(organizations)
      .set({
        lifecycle: "offboarding",
        status: "offboarding",
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    if (subscription) {
      const { transitionSubscription } = await import(
        "./subscription-lifecycle"
      );
      await transitionSubscription(subscription.id, "offboarding", "tenant_offboarding");
    }

    await tx.insert(auditEvents).values({
      organizationId,
      action: "offboarding.initiated",
      entityType: "organization",
      entityId: organizationId,
      payload: {
        previousLifecycle: org.lifecycle,
        previousStatus: org.status,
      },
      createdAt: new Date(),
    });
  });

  return {
    organizationId,
    currentStep: "initiated",
    completedSteps: ["initiated"],
    startedAt: new Date(),
  };
}

export async function exportOrganizationData(
  organizationId: string
): Promise<{ exportUrl: string; expiresAt: Date }> {
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("../../../db");
  const { organizations, auditEvents } = await import(
    "../../../db/schema-platform"
  );

  const db = await getDb();

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error("Organization not found");
  }

  if (org.lifecycle !== "offboarding") {
    throw new Error("Organization must be in offboarding state");
  }

  const exportData = {
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      sector: org.sector,
      metadata: org.metadata,
      createdAt: org.createdAt,
    },
    exportedAt: new Date().toISOString(),
  };

  const exportKey = `exports/${organizationId}/${Date.now()}.json`;

  await db.insert(auditEvents).values({
    organizationId,
    action: "offboarding.data_exported",
    entityType: "organization",
    entityId: organizationId,
    payload: {
      exportKey,
      recordCount: 1,
    },
    createdAt: new Date(),
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return {
    exportUrl: `/api/platform/offboarding/exports/${organizationId}`,
    expiresAt,
  };
}

export async function settleFinancials(
  organizationId: string
): Promise<{ settled: boolean; amount: number }> {
  const { eq, and, ne } = await import("drizzle-orm");
  const { getDb } = await import("../../../db");
  const {
    organizations,
    subscriptions,
    invoices,
    auditEvents,
  } = await import("../../../db/schema-platform");

  const db = await getDb();

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error("Organization not found");
  }

  const outstandingInvoices = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.organizationId, organizationId),
        ne(invoices.status, "paid")
      )
    );

  const totalOutstanding = outstandingInvoices.reduce(
    (sum, inv) => sum + inv.amount,
    0
  );

  await db.transaction(async (tx) => {
    for (const invoice of outstandingInvoices) {
      await tx
        .update(invoices)
        .set({
          status: "voided",
          metadata: {
            ...invoice.metadata,
            voidedReason: "offboarding",
            voidedAt: new Date().toISOString(),
          },
        })
        .where(eq(invoices.id, invoice.id));
    }

    const [subscription] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .limit(1);

    if (subscription) {
      const { transitionSubscription } = await import(
        "./subscription-lifecycle"
      );
      await transitionSubscription(
        subscription.id,
        "terminated",
        "offboarding_settled"
      );
    }

    await tx.insert(auditEvents).values({
      organizationId,
      action: "offboarding.settled",
      entityType: "organization",
      entityId: organizationId,
      payload: {
        outstandingInvoices: outstandingInvoices.length,
        totalOutstanding,
        invoicesVoided: outstandingInvoices.map((inv) => inv.id),
      },
      createdAt: new Date(),
    });
  });

  return {
    settled: true,
    amount: totalOutstanding,
  };
}

export async function retainData(
  organizationId: string,
  retentionDays: number
): Promise<void> {
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("../../../db");
  const { organizations, auditEvents } = await import(
    "../../../db/schema-platform"
  );

  const db = await getDb();

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error("Organization not found");
  }

  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + retentionDays);

  await db.transaction(async (tx) => {
    await tx
      .update(organizations)
      .set({
        metadata: {
          ...org.metadata,
          retentionDays,
          scheduledDeletionAt: deletionDate.toISOString(),
          dataRetained: true,
        },
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    await tx.insert(auditEvents).values({
      organizationId,
      action: "offboarding.retained",
      entityType: "organization",
      entityId: organizationId,
      payload: {
        retentionDays,
        scheduledDeletionAt: deletionDate.toISOString(),
      },
      createdAt: new Date(),
    });
  });
}

export async function deleteOrganizationData(
  organizationId: string
): Promise<void> {
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("../../../db");
  const {
    organizations,
    memberships,
    subscriptions,
    tenantDomains,
    supportTickets,
    invoices,
    auditEvents,
  } = await import("../../../db/schema-platform");

  const db = await getDb();

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error("Organization not found");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(auditEvents)
      .set({
        actorId: null,
        actorEmail: "deleted@system.local",
        payload: {
          originalAction: "redacted_for_deletion",
          deletedAt: new Date().toISOString(),
        },
      })
      .where(eq(auditEvents.organizationId, organizationId));

    await tx
      .delete(supportTickets)
      .where(eq(supportTickets.organizationId, organizationId));

    await tx
      .delete(invoices)
      .where(eq(invoices.organizationId, organizationId));

    await tx
      .delete(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId));

    await tx
      .delete(memberships)
      .where(eq(memberships.organizationId, organizationId));

    await tx
      .delete(tenantDomains)
      .where(eq(tenantDomains.organizationId, organizationId));

    await tx
      .update(organizations)
      .set({
        name: "Deleted Organization",
        slug: `deleted-${organizationId.slice(0, 8)}`,
        status: "deleted",
        lifecycle: "archived",
        metadata: {
          deletedAt: new Date().toISOString(),
          originalSlug: org.slug,
          originalName: org.name,
        },
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));
  });
}
