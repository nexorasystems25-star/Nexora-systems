import { count } from "drizzle-orm";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { requirePermission } from "../_access";
import { apiJson, safeApi } from "../_security";

export async function GET(request: Request) {
  return safeApi(request, "Service health check failed", async (requestId) => {
    const access = await requirePermission(request, "dashboard.read");
    if (access.response) return access.response;
    await (await getDb()).select({ value: count() }).from(users);
    return apiJson({ status: "ok", database: "available", checkedAt: new Date().toISOString() }, 200, requestId);
  });
}
