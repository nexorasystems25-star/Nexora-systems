import { count, desc, eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  cfCommunicationCampaigns,
  cfMembers,
} from "../../../db/schema-platform";
import { withTenantContext, writeTenantAudit } from "../_tenant";
import { ApiError, apiJson, readJson } from "../_security";
import type { PlatformUser } from "../../lib/auth-platform";

const CHANNELS = [
  "SMS",
  "Email",
  "WhatsApp",
  "In-app",
] as const;
const AUDIENCES = [
  "All Members",
  "Active Members",
  "New Converts",
  "Follow-up",
  "Youth Ministry",
  "Women's Ministry",
  "Men's Ministry",
  "Choir",
] as const;
const STATUSES = ["Draft", "Scheduled", "Cancelled"] as const;

function text(
  value: unknown,
  label: string,
  max: number,
  required = false
) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result)
    throw new ApiError(400, `${label} is required`);
  if (result.length > max)
    throw new ApiError(400, `${label} is too long`);
  return result;
}

function oneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string
): T[number] {
  if (
    typeof value !== "string" ||
    !allowed.includes(value)
  )
    throw new ApiError(400, `${label} is invalid`);
  return value as T[number];
}

async function audienceSize(tenantId: string, audience: string) {
  const db = await getDb();
  if (audience === "All Members")
    return (
      await db
        .select({ value: count() })
        .from(cfMembers)
        .where(eq(cfMembers.tenantId, tenantId))
    )[0].value;
  if (audience === "Active Members")
    return (
      await db
        .select({ value: count() })
        .from(cfMembers)
        .where(
          and(
            eq(cfMembers.tenantId, tenantId),
            eq(cfMembers.status, "Active")
          )
        )
    )[0].value;
  if (
    ["New Converts", "Follow-up"].includes(audience)
  ) {
    const status =
      audience === "New Converts"
        ? "New convert"
        : "Follow-up";
    return (
      await db
        .select({ value: count() })
        .from(cfMembers)
        .where(
          and(
            eq(cfMembers.tenantId, tenantId),
            eq(cfMembers.status, status)
          )
        )
    )[0].value;
  }
  return (
    await db
      .select({ value: count() })
      .from(cfMembers)
      .where(
        and(
          eq(cfMembers.tenantId, tenantId),
          eq(cfMembers.groupName, audience)
        )
      )
  )[0].value;
}

async function listCampaigns(tenantId: string) {
  return (await getDb())
    .select()
    .from(cfCommunicationCampaigns)
    .where(eq(cfCommunicationCampaigns.tenantId, tenantId))
    .orderBy(desc(cfCommunicationCampaigns.createdAt));
}

export async function GET(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const campaigns = await listCampaigns(tenantId);
      return apiJson(
        { campaigns, channels: CHANNELS, audiences: AUDIENCES },
        200,
        requestId
      );
    },
    { permission: "communication:read" }
  );
}

export async function POST(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<Record<string, unknown>>(request);
      const name = text(payload.name, "Campaign name", 160, true);
      const channel = oneOf(
        payload.channel,
        CHANNELS,
        "Channel"
      );
      const audience = oneOf(
        payload.audience,
        AUDIENCES,
        "Audience"
      );
      const subject = text(payload.subject, "Subject", 180);
      const message = text(
        payload.message,
        "Message",
        channel === "SMS" ? 480 : 5000,
        true
      );
      if (channel === "Email" && !subject)
        throw new ApiError(
          400,
          "Email subject is required"
        );

      const recipientCount = await audienceSize(
        tenantId,
        audience
      );
      const campaignCode = `COM-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

      const db = await getDb();
      const [created] = await db
        .insert(cfCommunicationCampaigns)
        .values({
          tenantId,
          campaignCode,
          name,
          channel,
          audience,
          subject: subject || null,
          message,
          recipientCount,
          status: "Draft",
          createdByUserId: user.identityId,
          createdByName: user.fullName,
          createdByEmail: user.email,
        })
        .returning();

      await writeTenantAudit(
        tenantId,
        user,
        "communication.campaign.create",
        "communication_campaign",
        String(created.id),
        `Created campaign: ${campaignCode}`
      );

      return apiJson({ campaign: created }, 201, requestId);
    },
    { permission: "communication:write" }
  );
}

export async function PATCH(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<{
          id?: unknown;
          status?: unknown;
          scheduledAt?: unknown;
        }>(request);
      const id = Number(payload.id);
      if (!Number.isSafeInteger(id) || id < 1)
        throw new ApiError(400, "Campaign is invalid");
      const status = oneOf(
        payload.status,
        STATUSES,
        "Status"
      );

      const db = await getDb();
      const [existing] = await db
        .select()
        .from(cfCommunicationCampaigns)
        .where(
          and(
            eq(cfCommunicationCampaigns.id, id),
            eq(cfCommunicationCampaigns.tenantId, tenantId)
          )
        )
        .limit(1);
      if (!existing)
        throw new ApiError(404, "Campaign was not found");
      if (existing.status === "Sent")
        throw new ApiError(
          409,
          "Sent campaign logs are immutable"
        );

      let scheduledAt: string | null =
        existing.scheduledAt;
      if (status === "Scheduled") {
        const supplied = text(
          payload.scheduledAt,
          "Schedule",
          30,
          true
        );
        const date = new Date(supplied);
        if (
          Number.isNaN(date.getTime()) ||
          date.getTime() <= Date.now()
        )
          throw new ApiError(
            400,
            "Choose a future delivery time"
          );
        scheduledAt = date.toISOString();
      } else if (status !== "Scheduled") {
        scheduledAt = null;
      }

      await db
        .update(cfCommunicationCampaigns)
        .set({
          status,
          scheduledAt,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(cfCommunicationCampaigns.id, id),
            eq(cfCommunicationCampaigns.tenantId, tenantId)
          )
        );

      const [updated] = await db
        .select()
        .from(cfCommunicationCampaigns)
        .where(
          and(
            eq(cfCommunicationCampaigns.id, id),
            eq(cfCommunicationCampaigns.tenantId, tenantId)
          )
        )
        .limit(1);

      await writeTenantAudit(
        tenantId,
        user,
        "communication.campaign.status_change",
        "communication_campaign",
        String(id),
        `Status: ${existing.status} → ${status}`
      );

      return apiJson({ campaign: updated }, 200, requestId);
    },
    { permission: "communication:write" }
  );
}
