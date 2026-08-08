import { getDb } from "../../db";
import { auditLogs } from "../../db/schema";
import type { AccessUser } from "./_access";

export async function writeAudit(
  actor: AccessUser,
  action: string,
  entityType: string,
  entityId: string | number,
  requestId: string,
  detail?: Record<string, string | number | boolean | null>,
) {
  const db = await getDb();
  await db.insert(auditLogs).values({
    actorEmail: actor.email,
    actorName: actor.name,
    action,
    entityType,
    entityId: String(entityId),
    detail: detail ? JSON.stringify(detail) : null,
    requestId,
  });
}
