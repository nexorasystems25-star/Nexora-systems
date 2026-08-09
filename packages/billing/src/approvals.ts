export type ApprovalType =
  | "contract"
  | "release"
  | "refund"
  | "suspension"
  | "offboarding";

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  requestedBy: string;
  organizationId: string;
  status: ApprovalStatus;
  createdAt: Date;
  expiresAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
}

export async function requestApproval(
  type: ApprovalType,
  requestedBy: string,
  organizationId: string,
  notes?: string
): Promise<ApprovalRequest> {
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

  const id = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setHours(expiresAt.getHours() + 24);

  await db.insert(auditEvents).values({
    organizationId,
    action: "approval.requested",
    entityType: "approval",
    entityId: id,
    payload: {
      type,
      requestedBy,
      notes,
      expiresAt: expiresAt.toISOString(),
    },
    createdAt: now,
  });

  return {
    id,
    type,
    requestedBy,
    organizationId,
    status: "pending",
    createdAt: now,
    expiresAt,
    notes,
  };
}

export async function approveRequest(
  requestId: string,
  approvedBy: string,
  notes?: string
): Promise<{ success: boolean }> {
  const { getDb } = await import("../../../db");
  const { auditEvents } = await import("../../../db/schema-platform");

  const db = await getDb();
  const now = new Date();

  await db.insert(auditEvents).values({
    action: "approval.approved",
    entityType: "approval",
    entityId: requestId,
    payload: {
      approvedBy,
      notes,
      approvedAt: now.toISOString(),
    },
    createdAt: now,
  });

  return { success: true };
}

export async function rejectRequest(
  requestId: string,
  rejectedBy: string,
  reason: string
): Promise<{ success: boolean }> {
  const { getDb } = await import("../../../db");
  const { auditEvents } = await import("../../../db/schema-platform");

  const db = await getDb();
  const now = new Date();

  await db.insert(auditEvents).values({
    action: "approval.rejected",
    entityType: "approval",
    entityId: requestId,
    payload: {
      rejectedBy,
      reason,
      rejectedAt: now.toISOString(),
    },
    createdAt: now,
  });

  return { success: true };
}

export async function getPendingApprovals(): Promise<ApprovalRequest[]> {
  const { getDb } = await import("../../../db");
  const { auditEvents } = await import("../../../db/schema-platform");
  const { eq, and } = await import("drizzle-orm");

  const db = await getDb();

  const events = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.action, "approval.requested"));

  const pendingApprovals: ApprovalRequest[] = [];

  for (const event of events) {
    const payload = event.payload as {
      type: ApprovalType;
      requestedBy: string;
      notes?: string;
      expiresAt: string;
    };

    const approvedEvent = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.entityId, event.entityId),
          eq(auditEvents.action, "approval.approved")
        )
      )
      .limit(1);

    const rejectedEvent = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.entityId, event.entityId),
          eq(auditEvents.action, "approval.rejected")
        )
      )
      .limit(1);

    let status: ApprovalStatus = "pending";
    let approvedBy: string | undefined;
    let approvedAt: Date | undefined;

    if (approvedEvent.length > 0) {
      status = "approved";
      const approvedPayload = approvedEvent[0].payload as {
        approvedBy: string;
        approvedAt: string;
      };
      approvedBy = approvedPayload.approvedBy;
      approvedAt = new Date(approvedPayload.approvedAt);
    } else if (rejectedEvent.length > 0) {
      status = "rejected";
    } else if (new Date(payload.expiresAt) < new Date()) {
      status = "expired";
    }

    if (status === "pending") {
      pendingApprovals.push({
        id: event.entityId!,
        type: payload.type,
        requestedBy: payload.requestedBy,
        organizationId: event.organizationId!,
        status,
        createdAt: event.createdAt,
        expiresAt: new Date(payload.expiresAt),
        approvedBy,
        approvedAt,
        notes: payload.notes,
      });
    }
  }

  return pendingApprovals;
}
