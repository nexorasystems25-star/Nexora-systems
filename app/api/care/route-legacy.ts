import { asc, count, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { careActivities, careCases, members } from "../../../db/schema";
import { hasPermission } from "../../../lib/access";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

const PERSON_TYPES = ["Member", "New Convert", "Visitor", "Household"] as const;
const PRIORITIES = ["Urgent", "High", "Normal", "Low"] as const;
const STATUSES = ["Open", "Resolved", "Closed"] as const;
const STAGES = ["New", "First Contact", "Second Contact", "Visit Scheduled", "Assessment", "Follow-up", "Foundation Class", "Resolved"] as const;

function text(value: unknown, label: string, max: number, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new ApiError(400, `${label} is required`);
  if (result.length > max) throw new ApiError(400, `${label} is too long`);
  return result;
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, label: string, fallback?: T[number]): T[number] {
  if ((value === undefined || value === "") && fallback) return fallback;
  if (typeof value !== "string" || !allowed.includes(value)) throw new ApiError(400, `${label} is invalid`);
  return value as T[number];
}

function idOf(value: unknown) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "Care case is invalid");
  return id;
}

function optionalDate(value: unknown) {
  const date = text(value, "Next action date", 10);
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new ApiError(400, "Next action date is invalid");
  }
  return date;
}

async function seedIfEmpty(actorName: string) {
  const db = await getDb();
  const [result] = await db.select({ value: count() }).from(careCases);
  if (result.value) return;
  const memberRows = await db.select().from(members).orderBy(asc(members.id));
  await db.insert(careCases).values([
    { caseCode: "CARE-2607-001", memberId: memberRows[2]?.id, personName: "Abena Boateng", personPhone: "020 771 1904", personType: "New Convert", caseType: "New Convert Follow-up", source: "Sunday altar call", priority: "High", stage: "First Contact", assignedTo: "Rev. Lydia Owusu", nextActionDate: "2026-07-31", summary: "Welcome call and foundation class introduction required.", status: "Open", createdBy: actorName },
    { caseCode: "CARE-2607-002", memberId: memberRows[3]?.id, personName: "Kofi Asare", personPhone: "027 120 3301", personType: "Member", caseType: "Pastoral Follow-up", priority: "Normal", stage: "Visit Scheduled", assignedTo: "Pastor Daniel Asante", nextActionDate: "2026-08-01", summary: "Home visit requested after extended absence.", sensitiveNotes: "Discuss privately with the assigned pastor.", isConfidential: true, status: "Open", createdBy: actorName },
    { caseCode: "CARE-2607-003", personName: "Yaa Serwaa", personPhone: "050 410 2219", personType: "Visitor", caseType: "Visitor Follow-up", source: "Invited by Akosua Mensah", priority: "Normal", stage: "Second Contact", assignedTo: "Membership Team", nextActionDate: "2026-08-02", summary: "Interested in the women’s fellowship and membership class.", status: "Open", createdBy: actorName },
    { caseCode: "CARE-2607-004", memberId: memberRows[0]?.id, personName: "Mensah Household", personPhone: "024 000 1842", personType: "Household", caseType: "Welfare Request", priority: "Urgent", stage: "Assessment", assignedTo: "Welfare Committee", nextActionDate: "2026-07-30", summary: "Short-term household support assessment pending.", sensitiveNotes: "Financial circumstances restricted to pastoral and welfare leadership.", isConfidential: true, status: "Open", createdBy: actorName },
  ]);
  const cases = await db.select().from(careCases).orderBy(asc(careCases.id));
  if (cases[0]) await db.insert(careActivities).values({ caseId: cases[0].id, activityType: "Phone call", note: "Initial welcome call completed.", outcome: "Accepted foundation class invitation", completedBy: actorName });
}

async function listCases(includeConfidential: boolean) {
  const db = await getDb();
  const rows = await db.select({
    id: careCases.id, code: careCases.caseCode, memberChurchId: members.churchId,
    personName: careCases.personName, personPhone: careCases.personPhone, personType: careCases.personType,
    caseType: careCases.caseType, source: careCases.source, priority: careCases.priority, stage: careCases.stage,
    assignedTo: careCases.assignedTo, nextActionDate: careCases.nextActionDate, summary: careCases.summary,
    sensitiveNotes: careCases.sensitiveNotes, isConfidential: careCases.isConfidential, status: careCases.status,
    createdAt: careCases.createdAt,
  }).from(careCases).leftJoin(members, eq(careCases.memberId, members.id)).orderBy(desc(careCases.createdAt));
  const visibleRows = includeConfidential ? rows : rows.filter((row) => !row.isConfidential);
  const visibleIds = new Set(visibleRows.map((row) => row.id));
  const activities = (await db.select().from(careActivities).orderBy(desc(careActivities.completedAt)))
    .filter((activity) => visibleIds.has(activity.caseId));
  return visibleRows.map((row) => ({
    ...row,
    personPhone: row.personPhone || undefined,
    sensitiveNotes: includeConfidential ? row.sensitiveNotes || undefined : undefined,
    activities: activities.filter((activity) => activity.caseId === row.id),
  }));
}

async function requireCaseAccess(caseId: number, confidentialAccess: boolean) {
  const db = await getDb();
  const [careCase] = await db.select().from(careCases).where(eq(careCases.id, caseId)).limit(1);
  if (!careCase) throw new ApiError(404, "Care case was not found");
  if (careCase.isConfidential && !confidentialAccess) {
    throw new ApiError(403, "Confidential care access is required");
  }
  return careCase;
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load care records", async (requestId) => {
    const access = await requirePermission(request, "care.read");
    if (access.response) return access.response;
    await seedIfEmpty(access.user!.name);
    const confidentialAccess = hasPermission(access.user!.role, "care.confidential.read");
    const cases = await listCases(confidentialAccess);
    if (confidentialAccess) {
      await writeAudit(access.user!, "care.confidential.list.viewed", "care_case", "list", requestId, {
        visibleConfidentialCases: cases.filter((item) => item.isConfidential).length,
      });
    }
    return apiJson({ cases, confidentialAccess }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to create care record", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "care.manage");
    if (access.response) return access.response;
    const confidentialAccess = hasPermission(access.user!.role, "care.confidential.read");

    if (payload.action === "activity") {
      const caseId = idOf(payload.caseId);
      await requireCaseAccess(caseId, confidentialAccess);
      const activityType = text(payload.activityType, "Activity type", 80) || "Follow-up";
      const note = text(payload.note, "Follow-up note", 2000, true);
      const outcome = text(payload.outcome, "Outcome", 500);
      const stage = oneOf(payload.stage, STAGES, "Stage", "Follow-up");
      const nextActionDate = optionalDate(payload.nextActionDate);
      const db = await getDb();
      await db.insert(careActivities).values({ caseId, activityType, note, outcome: outcome || null, completedBy: access.user!.name });
      await db.update(careCases).set({ stage, nextActionDate, updatedAt: new Date().toISOString() }).where(eq(careCases.id, caseId));
      await writeAudit(access.user!, "care.activity.created", "care_case", caseId, requestId, { activityType, stage });
      return apiJson({ cases: await listCases(confidentialAccess) }, 201, requestId);
    }

    const personName = text(payload.personName, "Person", 120, true);
    const caseType = text(payload.caseType, "Case type", 120, true);
    const summary = text(payload.summary, "Summary", 2000, true);
    const confidential = payload.isConfidential === true;
    if (confidential && !confidentialAccess) throw new ApiError(403, "Confidential care access is required");
    const db = await getDb();
    let memberId: number | null = null;
    const memberChurchId = text(payload.memberChurchId, "Member church ID", 30);
    if (memberChurchId) {
      const [member] = await db.select().from(members).where(eq(members.churchId, memberChurchId)).limit(1);
      if (!member) throw new ApiError(400, "Selected member was not found");
      memberId = member.id;
    }
    const code = `CARE-${new Date().toISOString().slice(2, 7).replace("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const [created] = await db.insert(careCases).values({
      caseCode: code,
      memberId,
      personName,
      personPhone: text(payload.personPhone, "Phone", 40) || null,
      personType: oneOf(payload.personType, PERSON_TYPES, "Person type", "Member"),
      caseType,
      source: text(payload.source, "Source", 120) || "Church office",
      priority: oneOf(payload.priority, PRIORITIES, "Priority", "Normal"),
      stage: oneOf(payload.stage, STAGES, "Stage", "New"),
      assignedTo: text(payload.assignedTo, "Assigned team", 120) || "Pastoral Care Team",
      nextActionDate: optionalDate(payload.nextActionDate),
      summary,
      sensitiveNotes: confidential ? text(payload.sensitiveNotes, "Sensitive notes", 3000) || null : null,
      isConfidential: confidential,
      createdBy: access.user!.name,
    }).returning({ id: careCases.id });
    await writeAudit(access.user!, "care.case.created", "care_case", created.id, requestId, { caseType, confidential });
    return apiJson({ case: (await listCases(confidentialAccess)).find((item) => item.id === created.id) }, 201, requestId);
  });
}

export async function PATCH(request: Request) {
  return safeApi(request, "Unable to update care record", async (requestId) => {
    const payload = await readJson<{ id?: unknown; status?: unknown; stage?: unknown }>(request);
    const access = await requirePermission(request, "care.manage");
    if (access.response) return access.response;
    const id = idOf(payload.id);
    const confidentialAccess = hasPermission(access.user!.role, "care.confidential.read");
    await requireCaseAccess(id, confidentialAccess);
    const status = oneOf(payload.status, STATUSES, "Status", "Open");
    const stage = oneOf(payload.stage, STAGES, "Stage", "Follow-up");
    const db = await getDb();
    await db.update(careCases).set({ status, stage, updatedAt: new Date().toISOString() }).where(eq(careCases.id, id));
    await writeAudit(access.user!, "care.case.updated", "care_case", id, requestId, { stage, status });
    return apiJson({ cases: await listCases(confidentialAccess) }, 200, requestId);
  });
}
