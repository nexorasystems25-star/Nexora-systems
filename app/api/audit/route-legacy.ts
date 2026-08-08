import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs } from "../../../db/schema";
import { requirePermission } from "../_access";
import { apiJson, safeApi } from "../_security";

export async function GET(request: Request) {
  return safeApi(request, "Unable to load audit activity", async (requestId) => {
    const access = await requirePermission(request, "administration.manage");
    if (access.response) return access.response;
    const rows = await (await getDb()).select({
      id: auditLogs.id,
      actorName: auditLogs.actorName,
      actorEmail: auditLogs.actorEmail,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      requestId: auditLogs.requestId,
      createdAt: auditLogs.createdAt,
    }).from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    return apiJson({ logs: rows }, 200, requestId);
  });
}
