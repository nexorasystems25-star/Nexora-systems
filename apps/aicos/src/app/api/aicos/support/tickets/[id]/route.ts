import { apiJson, getRequestId, readJson, ApiError } from "../../../../../../lib/guard";
import { requirePlatformStaff, requirePermission } from "../../../../../../lib/guard";
import { aicosDb } from "../../../../../../lib/db";
import { supportTickets, supportTicketMessages } from "@nexora/db";
import { eq, desc } from "drizzle-orm";

const STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePlatformStaff(request);
  requirePermission(user, "support:read");
  const { id } = await params;
  const requestId = getRequestId(request);

  const [ticket] = await aicosDb
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id))
    .limit(1);
  if (!ticket) throw new ApiError(404, "Ticket not found");

  const messages = await aicosDb
    .select()
    .from(supportTicketMessages)
    .where(eq(supportTicketMessages.ticketId, id))
    .orderBy(desc(supportTicketMessages.createdAt));

  return apiJson({ ticket, messages: messages.reverse() }, 200, requestId);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePlatformStaff(request);
  requirePermission(user, "support:manage");
  const { id } = await params;
  const requestId = getRequestId(request);
  const body = await readJson<{
    status?: string;
    priority?: string;
    assignedTo?: string | null;
  }>(request);

  const update: Record<string, unknown> = {};
  if (body.status && STATUSES.includes(body.status)) {
    update.status = body.status;
    if (body.status === "resolved" || body.status === "closed") {
      update.resolvedAt = new Date();
    }
  }
  if (body.priority && PRIORITIES.includes(body.priority)) {
    update.priority = body.priority;
  }
  if (typeof body.assignedTo === "string") {
    update.assignedTo = body.assignedTo || null;
  }
  if (Object.keys(update).length === 0) {
    throw new ApiError(422, "No valid fields to update");
  }

  const [ticket] = await aicosDb
    .update(supportTickets)
    .set(update)
    .where(eq(supportTickets.id, id))
    .returning();
  if (!ticket) throw new ApiError(404, "Ticket not found");
  return apiJson({ ticket }, 200, requestId);
}
