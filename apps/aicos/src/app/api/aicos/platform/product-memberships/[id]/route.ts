import { apiJson, getRequestId, ApiError } from "../../../../../../lib/guard";
import { requirePlatformStaff, requirePermission } from "../../../../../../lib/guard";
import { aicosDb } from "../../../../../../lib/db";
import { productMemberships } from "@nexora/db";
import { eq } from "drizzle-orm";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePlatformStaff(request);
  requirePermission(user, "product:manage");
  const { id } = await params;
  const requestId = getRequestId(request);

  const [deleted] = await aicosDb
    .delete(productMemberships)
    .where(eq(productMemberships.id, id))
    .returning();
  if (!deleted) throw new ApiError(404, "Membership not found");
  return apiJson({ deleted: true, id }, 200, requestId);
}
