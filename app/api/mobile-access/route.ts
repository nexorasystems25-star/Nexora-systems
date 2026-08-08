import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { mobileDevices, users } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load mobile access", async (requestId) => {
    const access = await requirePermission(request, "administration.manage");
    if (access.response) return access.response;
    const db = await getDb();
    const rows = await db.select({
      id: mobileDevices.id, userId: mobileDevices.userId, userName: users.name, userEmail: users.email,
      deviceName: mobileDevices.deviceName, status: mobileDevices.status, lastUsedAt: mobileDevices.lastUsedAt,
      expiresAt: mobileDevices.expiresAt, createdAt: mobileDevices.createdAt,
    }).from(mobileDevices).leftJoin(users, eq(mobileDevices.userId, users.id)).orderBy(asc(users.name));
    return apiJson({ devices: rows }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to issue mobile access", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "administration.manage");
    if (access.response) return access.response;
    const userId = Number(payload.userId);
    const deviceName = typeof payload.deviceName === "string" ? payload.deviceName.trim().slice(0, 100) : "ChurchFlow Mobile";
    if (!Number.isInteger(userId)) throw new ApiError(400, "Choose an authorised user");
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.status !== "Active") throw new ApiError(404, "Active user was not found");
    await db.update(mobileDevices).set({ status: "Revoked", revokedAt: new Date().toISOString() }).where(and(eq(mobileDevices.userId, userId), eq(mobileDevices.status, "Active")));
    const token = `cfm_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
    const expiresAt = new Date(Date.now() + 180 * 86400000).toISOString();
    const [device] = await db.insert(mobileDevices).values({
      userId, tokenHash: await hashToken(token), deviceName: deviceName || "ChurchFlow Mobile",
      expiresAt, createdByUserId: access.user!.id, createdByName: access.user!.name,
    }).returning({ id: mobileDevices.id });
    await writeAudit(access.user!, "mobile.access.issued", "mobile_device", device.id, requestId, { userId, deviceName, expiresAt });
    return apiJson({ activationToken: token, expiresAt, user: { id: user.id, name: user.name, email: user.email, role: user.role } }, 201, requestId);
  });
}

export async function PATCH(request: Request) {
  return safeApi(request, "Unable to revoke mobile access", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "administration.manage");
    if (access.response) return access.response;
    const id = Number(payload.id);
    if (!Number.isInteger(id)) throw new ApiError(400, "Choose a mobile device");
    const db = await getDb();
    const [device] = await db.select().from(mobileDevices).where(eq(mobileDevices.id, id)).limit(1);
    if (!device) throw new ApiError(404, "Mobile device was not found");
    await db.update(mobileDevices).set({ status: "Revoked", revokedAt: new Date().toISOString() }).where(eq(mobileDevices.id, id));
    await writeAudit(access.user!, "mobile.access.revoked", "mobile_device", id, requestId, { userId: device.userId });
    return apiJson({ revoked: true }, 200, requestId);
  });
}
