import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { cfAuditLogs } from "../../../db/schema-platform";
import { withTenantContext } from "../_tenant";
import { apiJson } from "../_security";
import type { PlatformUser } from "../../lib/auth-platform";

export async function GET(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const db = await getDb();
      const rows = await db
        .select({
          id: cfAuditLogs.id,
          actorName: cfAuditLogs.actorName,
          actorEmail: cfAuditLogs.actorEmail,
          action: cfAuditLogs.action,
          entityType: cfAuditLogs.entityType,
          entityId: cfAuditLogs.entityId,
          detail: cfAuditLogs.detail,
          createdAt: cfAuditLogs.createdAt,
        })
        .from(cfAuditLogs)
        .where(eq(cfAuditLogs.tenantId, tenantId))
        .orderBy(desc(cfAuditLogs.createdAt))
        .limit(100);

      return apiJson({ logs: rows }, 200, requestId);
    },
    { permission: "audit:read" }
  );
}
