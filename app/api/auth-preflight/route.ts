import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

export async function POST(request: Request) {
  return safeApi(request, "Unable to verify account", async (requestId) => {
    const payload = await readJson<{ email?: unknown }>(request);
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "Enter a valid email address");
    const [user] = await (await getDb()).select({ status: users.status }).from(users).where(eq(users.email, email)).limit(1);
    return apiJson({ approved: user?.status === "Active" }, 200, requestId);
  });
}
