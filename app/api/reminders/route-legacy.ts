import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { celebrationReminders, communicationCampaigns, members } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

function nextOccurrence(source: string, now = new Date()) {
  const parts = source.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const year = now.getUTCFullYear();
  let candidate = new Date(Date.UTC(year, parts[1] - 1, parts[2]));
  const today = new Date(Date.UTC(year, now.getUTCMonth(), now.getUTCDate()));
  if (candidate < today) candidate = new Date(Date.UTC(year + 1, parts[1] - 1, parts[2]));
  return candidate.toISOString().slice(0, 10);
}

async function upcoming() {
  const db = await getDb();
  const rows = await db.select({
    id: members.id, churchId: members.churchId, name: members.name, phone: members.phone, email: members.email,
    birthDate: members.birthDate, weddingDate: members.weddingDate, maritalStatus: members.maritalStatus, group: members.groupName,
  }).from(members).where(eq(members.status, "Active")).orderBy(asc(members.name));
  const today = new Date(); const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return rows.flatMap((member) => {
    const items: Array<Record<string, unknown>> = [];
    for (const [type, source] of [["Birthday", member.birthDate], ["Wedding Anniversary", member.weddingDate]] as const) {
      if (!source) continue;
      const occurrenceDate = nextOccurrence(source);
      if (!occurrenceDate) continue;
      const daysUntil = Math.round((Date.parse(`${occurrenceDate}T00:00:00Z`) - todayUtc) / 86400000);
      if (daysUntil <= 45) items.push({ memberId: member.id, churchId: member.churchId, name: member.name, phone: member.phone, email: member.email, group: member.group, type, occurrenceDate, daysUntil, years: Number(occurrenceDate.slice(0,4)) - Number(source.slice(0,4)) });
    }
    return items;
  }).sort((a, b) => Number(a.daysUntil) - Number(b.daysUntil));
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load celebration reminders", async (requestId) => {
    const access = await requirePermission(request, "reminders.read");
    if (access.response) return access.response;
    const db = await getDb();
    const prepared = await db.select().from(celebrationReminders).orderBy(asc(celebrationReminders.occurrenceDate));
    return apiJson({ reminders: await upcoming(), prepared }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to prepare reminder", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "reminders.manage");
    if (access.response) return access.response;
    const memberId = Number(payload.memberId);
    const celebrationType = typeof payload.celebrationType === "string" ? payload.celebrationType : "";
    const occurrenceDate = typeof payload.occurrenceDate === "string" ? payload.occurrenceDate : "";
    const channel = typeof payload.channel === "string" && ["SMS","Email","WhatsApp","In-app"].includes(payload.channel) ? payload.channel : "In-app";
    if (!Number.isInteger(memberId) || !["Birthday","Wedding Anniversary"].includes(celebrationType) || !/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) throw new ApiError(400, "Choose a valid celebration reminder");
    const list = await upcoming();
    const item = list.find((entry) => entry.memberId === memberId && entry.type === celebrationType && entry.occurrenceDate === occurrenceDate);
    if (!item) throw new ApiError(404, "This celebration is not in the upcoming reminder window");
    const db = await getDb();
    const [existing] = await db.select().from(celebrationReminders).where(eq(celebrationReminders.reminderCode, `${memberId}-${celebrationType}-${occurrenceDate}`)).limit(1);
    if (existing) throw new ApiError(409, "This reminder has already been prepared");
    const message = celebrationType === "Birthday" ? `Happy birthday ${item.name}! Grace Centre celebrates you and prays for a blessed new year.` : `Happy wedding anniversary ${item.name}! Grace Centre celebrates God’s faithfulness in your marriage.`;
    const [campaign] = await db.insert(communicationCampaigns).values({
      campaignCode: `CMP-${crypto.randomUUID().slice(0,8).toUpperCase()}`, name: `${celebrationType}: ${item.name}`,
      channel, audience: `Member ${item.churchId}`, subject: celebrationType, message, status: "Draft", recipientCount: 1,
      createdByUserId: access.user!.id, createdByName: access.user!.name, createdByEmail: access.user!.email,
    }).returning({ id: communicationCampaigns.id });
    const reminderCode = `${memberId}-${celebrationType}-${occurrenceDate}`;
    const [created] = await db.insert(celebrationReminders).values({
      reminderCode, memberId, celebrationType, occurrenceDate, channel, campaignId: campaign.id,
      preparedByUserId: access.user!.id, preparedByName: access.user!.name,
    }).returning({ id: celebrationReminders.id });
    await writeAudit(access.user!, "reminder.prepared", "celebration_reminder", created.id, requestId, { celebrationType, occurrenceDate, channel, campaignId: campaign.id });
    return apiJson({ reminders: await upcoming(), prepared: await db.select().from(celebrationReminders).orderBy(asc(celebrationReminders.occurrenceDate)) }, 201, requestId);
  });
}
