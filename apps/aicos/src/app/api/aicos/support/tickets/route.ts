import { apiJson, getRequestId, ApiError } from "../../../../../lib/guard";
import { requirePlatformStaff, requirePermission } from "../../../../../lib/guard";
import { aicosDb } from "../../../../../lib/db";
import { supportTickets, organizations } from "@nexora/db";
import { desc, eq, and, like } from "drizzle-orm";

// Platform-wide support queue. Any platform operator with support:read can
// list every tenant's tickets (product-agnostic control plane view).
export async function GET(request: Request) {
  const user = await requirePlatformStaff(request);
  requirePermission(user, "support:read");
  const requestId = getRequestId(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const priority = url.searchParams.get("priority") || undefined;
  const product = url.searchParams.get("product") || undefined;
  const q = url.searchParams.get("q") || undefined;

  const conditions = [];
  if (status) conditions.push(eq(supportTickets.status, status));
  if (priority) conditions.push(eq(supportTickets.priority, priority));
  if (product) conditions.push(eq(supportTickets.productId, product));
  if (q) conditions.push(like(supportTickets.subject, `%${q}%`));

  const rows = await aicosDb
    .select({ ticket: supportTickets, orgName: organizations.name })
    .from(supportTickets)
    .leftJoin(organizations, eq(supportTickets.organizationId, organizations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(supportTickets.createdAt));

  return apiJson(
    { tickets: rows.map((r) => ({ ...r.ticket, organizationName: r.orgName ?? "—" })) },
    200,
    requestId
  );
}
