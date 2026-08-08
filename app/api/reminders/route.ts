import { asc, eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  cfCelebrationReminders,
  cfCommunicationCampaigns,
  cfMembers,
} from "../../../db/schema-platform";
import { withTenantContext, writeTenantAudit } from "../_tenant";
import { ApiError, apiJson, readJson } from "../_security";
import type { PlatformUser } from "../../lib/auth-platform";

function nextOccurrence(source: string, now = new Date()) {
  const parts = source.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const year = now.getUTCFullYear();
  let candidate = new Date(Date.UTC(year, parts[1] - 1, parts[2]));
  const today = new Date(
    Date.UTC(year, now.getUTCMonth(), now.getUTCDate())
  );
  if (candidate < today)
    candidate = new Date(Date.UTC(year + 1, parts[1] - 1, parts[2]));
  return candidate.toISOString().slice(0, 10);
}

async function upcoming(tenantId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: cfMembers.id,
      churchId: cfMembers.churchId,
      name: cfMembers.name,
      phone: cfMembers.phone,
      email: cfMembers.email,
      birthDate: cfMembers.birthDate,
      weddingDate: cfMembers.weddingDate,
      maritalStatus: cfMembers.maritalStatus,
      group: cfMembers.groupName,
    })
    .from(cfMembers)
    .where(
      and(
        eq(cfMembers.tenantId, tenantId),
        eq(cfMembers.status, "Active")
      )
    )
    .orderBy(asc(cfMembers.name));

  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );

  return rows
    .flatMap((member) => {
      const items: Array<Record<string, unknown>> = [];
      for (const [type, source] of [
        ["Birthday", member.birthDate],
        ["Wedding Anniversary", member.weddingDate],
      ] as const) {
        if (!source) continue;
        const occurrenceDate = nextOccurrence(source);
        if (!occurrenceDate) continue;
        const daysUntil = Math.round(
          (Date.parse(`${occurrenceDate}T00:00:00Z`) - todayUtc) /
            86400000
        );
        if (daysUntil <= 45)
          items.push({
            memberId: member.id,
            churchId: member.churchId,
            name: member.name,
            phone: member.phone,
            email: member.email,
            group: member.group,
            type,
            occurrenceDate,
            daysUntil,
            years:
              Number(occurrenceDate.slice(0, 4)) -
              Number(source.slice(0, 4)),
          });
      }
      return items;
    })
    .sort((a, b) => Number(a.daysUntil) - Number(b.daysUntil));
}

export async function GET(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const db = await getDb();
      const prepared = await db
        .select()
        .from(cfCelebrationReminders)
        .where(eq(cfCelebrationReminders.tenantId, tenantId))
        .orderBy(asc(cfCelebrationReminders.occurrenceDate));

      const reminders = await upcoming(tenantId);
      return apiJson({ reminders, prepared }, 200, requestId);
    },
    { permission: "reminders:read" }
  );
}

export async function POST(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<Record<string, unknown>>(request);
      const memberId = Number(payload.memberId);
      const celebrationType =
        typeof payload.celebrationType === "string"
          ? payload.celebrationType
          : "";
      const occurrenceDate =
        typeof payload.occurrenceDate === "string"
          ? payload.occurrenceDate
          : "";
      const channel =
        typeof payload.channel === "string" &&
        ["SMS", "Email", "WhatsApp", "In-app"].includes(
          payload.channel
        )
          ? payload.channel
          : "In-app";

      if (
        !Number.isInteger(memberId) ||
        !["Birthday", "Wedding Anniversary"].includes(
          celebrationType
        ) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)
      )
        throw new ApiError(
          400,
          "Choose a valid celebration reminder"
        );

      const list = await upcoming(tenantId);
      const item = list.find(
        (entry) =>
          entry.memberId === memberId &&
          entry.type === celebrationType &&
          entry.occurrenceDate === occurrenceDate
      );
      if (!item)
        throw new ApiError(
          404,
          "This celebration is not in the upcoming reminder window"
        );

      const db = await getDb();
      const reminderCode = `${memberId}-${celebrationType}-${occurrenceDate}`;

      const [existing] = await db
        .select()
        .from(cfCelebrationReminders)
        .where(
          eq(cfCelebrationReminders.reminderCode, reminderCode)
        )
        .limit(1);
      if (existing)
        throw new ApiError(
          409,
          "This reminder has already been prepared"
        );

      const message =
        celebrationType === "Birthday"
          ? `Happy birthday ${item.name}! Grace Centre celebrates you and prays for a blessed new year.`
          : `Happy wedding anniversary ${item.name}! Grace Centre celebrates God's faithfulness in your marriage.`;

      const [campaign] = await db
        .insert(cfCommunicationCampaigns)
        .values({
          tenantId,
          campaignCode: `CMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          name: `${celebrationType}: ${item.name}`,
          channel,
          audience: `Member ${item.churchId}`,
          subject: celebrationType,
          message,
          status: "Draft",
          recipientCount: 1,
          createdByUserId: user.identityId,
          createdByName: user.fullName,
          createdByEmail: user.email,
        })
        .returning({ id: cfCommunicationCampaigns.id });

      const [created] = await db
        .insert(cfCelebrationReminders)
        .values({
          tenantId,
          reminderCode,
          memberId,
          celebrationType,
          occurrenceDate,
          channel,
          campaignId: campaign.id,
          preparedByUserId: user.identityId,
          preparedByName: user.fullName,
        })
        .returning({ id: cfCelebrationReminders.id });

      await writeTenantAudit(
        tenantId,
        user,
        "reminder.prepare",
        "celebration_reminder",
        String(created.id),
        `Prepared ${celebrationType} reminder for ${occurrenceDate}`
      );

      const reminders = await upcoming(tenantId);
      const prepared = await db
        .select()
        .from(cfCelebrationReminders)
        .where(eq(cfCelebrationReminders.tenantId, tenantId))
        .orderBy(asc(cfCelebrationReminders.occurrenceDate));

      return apiJson({ reminders, prepared }, 201, requestId);
    },
    { permission: "reminders:write" }
  );
}
