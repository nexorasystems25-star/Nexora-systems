import { apiJson, getRequestId, readJson, ApiError } from "../../../../../../../lib/guard";
import { requirePlatformStaff, requirePermission } from "../../../../../../../lib/guard";
import { aicosDb } from "../../../../../../../lib/db";
import { supportTickets, supportTicketMessages } from "@nexora/db";
import { eq } from "drizzle-orm";

// Agent reply or internal note. The ticket must exist before any write.
// `isInternal` notes are visible only to platform staff, never to the tenant.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePlatformStaff(request);
  requirePermission(user, "support:manage");
  const { id } = await params;
  const requestId = getRequestId(request);

  const body = await readJson<{ body?: string; isInternal?: boolean }>(request);
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) throw new ApiError(422, "Message body is required");
  const isInternal = Boolean(body.isInternal);

  const [ticket] = await aicosDb
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id))
    .limit(1);
  if (!ticket) throw new ApiError(404, "Ticket not found");

  const [message] = await aicosDb
    .insert(supportTicketMessages)
    .values({
      ticketId: id,
      authorIdentityId: user.identityId,
      authorScope: "platform",
      body: text,
      isInternal,
    })
    .returning();

  // Record first response and move an open ticket into progress.
  if (!ticket.firstResponseAt) {
    const nextStatus = ticket.status === "open" ? "in_progress" : ticket.status;
    await aicosDb
      .update(supportTickets)
      .set({ firstResponseAt: new Date(), status: nextStatus })
      .where(eq(supportTickets.id, id));
  }

  return apiJson({ message }, 201, requestId);
}
