import { count, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { communicationCampaigns, members } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

const CHANNELS = ["SMS", "Email", "WhatsApp", "In-app"] as const;
const AUDIENCES = ["All Members", "Active Members", "New Converts", "Follow-up", "Youth Ministry", "Women’s Ministry", "Men’s Ministry", "Choir"] as const;
const STATUSES = ["Draft", "Scheduled", "Cancelled"] as const;

function text(value: unknown, label: string, max: number, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new ApiError(400, `${label} is required`);
  if (result.length > max) throw new ApiError(400, `${label} is too long`);
  return result;
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) throw new ApiError(400, `${label} is invalid`);
  return value as T[number];
}

async function audienceSize(audience: string) {
  const db = await getDb();
  if (audience === "All Members") return (await db.select({ value: count() }).from(members))[0].value;
  if (audience === "Active Members") return (await db.select({ value: count() }).from(members).where(eq(members.status, "Active")))[0].value;
  if (["New Converts", "Follow-up"].includes(audience)) {
    const status = audience === "New Converts" ? "New convert" : "Follow-up";
    return (await db.select({ value: count() }).from(members).where(eq(members.status, status)))[0].value;
  }
  return (await db.select({ value: count() }).from(members).where(eq(members.groupName, audience)))[0].value;
}

async function listCampaigns() {
  return (await getDb()).select().from(communicationCampaigns).orderBy(desc(communicationCampaigns.createdAt));
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load communication campaigns", async (requestId) => {
    const access = await requirePermission(request, "communication.read");
    if (access.response) return access.response;
    return apiJson({ campaigns: await listCampaigns(), channels: CHANNELS, audiences: AUDIENCES }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to create communication campaign", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "communication.manage");
    if (access.response) return access.response;
    const name = text(payload.name, "Campaign name", 160, true);
    const channel = oneOf(payload.channel, CHANNELS, "Channel");
    const audience = oneOf(payload.audience, AUDIENCES, "Audience");
    const subject = text(payload.subject, "Subject", 180);
    const message = text(payload.message, "Message", channel === "SMS" ? 480 : 5000, true);
    if (channel === "Email" && !subject) throw new ApiError(400, "Email subject is required");
    const recipientCount = await audienceSize(audience);
    const campaignCode = `COM-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const db = await getDb();
    const [created] = await db.insert(communicationCampaigns).values({
      campaignCode,
      name,
      channel,
      audience,
      subject: subject || null,
      message,
      recipientCount,
      status: "Draft",
      createdByUserId: access.user!.id,
      createdByName: access.user!.name,
      createdByEmail: access.user!.email,
    }).returning();
    await writeAudit(access.user!, "communication.campaign.created", "communication_campaign", created.id, requestId, { campaignCode, channel, audience, recipientCount });
    return apiJson({ campaign: created }, 201, requestId);
  });
}

export async function PATCH(request: Request) {
  return safeApi(request, "Unable to update communication campaign", async (requestId) => {
    const payload = await readJson<{ id?: unknown; status?: unknown; scheduledAt?: unknown }>(request);
    const access = await requirePermission(request, "communication.manage");
    if (access.response) return access.response;
    const id = Number(payload.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "Campaign is invalid");
    const status = oneOf(payload.status, STATUSES, "Status");
    const db = await getDb();
    const [existing] = await db.select().from(communicationCampaigns).where(eq(communicationCampaigns.id, id)).limit(1);
    if (!existing) throw new ApiError(404, "Campaign was not found");
    if (existing.status === "Sent") throw new ApiError(409, "Sent campaign logs are immutable");
    let scheduledAt: string | null = existing.scheduledAt;
    if (status === "Scheduled") {
      const supplied = text(payload.scheduledAt, "Schedule", 30, true);
      const date = new Date(supplied);
      if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new ApiError(400, "Choose a future delivery time");
      scheduledAt = date.toISOString();
    } else if (status !== "Scheduled") {
      scheduledAt = null;
    }
    await db.update(communicationCampaigns).set({ status, scheduledAt, updatedAt: new Date().toISOString() }).where(eq(communicationCampaigns.id, id));
    const [updated] = await db.select().from(communicationCampaigns).where(eq(communicationCampaigns.id, id)).limit(1);
    await writeAudit(access.user!, "communication.campaign.status_changed", "communication_campaign", id, requestId, { previousStatus: existing.status, status });
    return apiJson({ campaign: updated }, 200, requestId);
  });
}
