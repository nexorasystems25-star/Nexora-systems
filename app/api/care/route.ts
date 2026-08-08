import { asc, count, desc, eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  cfCareCases,
  cfCareActivities,
  cfMembers,
} from "../../../db/schema-platform";
import { withTenantContext, writeTenantAudit } from "../_tenant";
import { ApiError, apiJson, readJson } from "../_security";
import type { PlatformUser } from "../../lib/auth-platform";

const PERSON_TYPES = ["Member", "New Convert", "Visitor", "Household"] as const;
const PRIORITIES = ["Urgent", "High", "Normal", "Low"] as const;
const STATUSES = ["Open", "Resolved", "Closed"] as const;
const STAGES = [
  "New",
  "First Contact",
  "Second Contact",
  "Visit Scheduled",
  "Assessment",
  "Follow-up",
  "Foundation Class",
  "Resolved",
] as const;

function text(value: unknown, label: string, max: number, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new ApiError(400, `${label} is required`);
  if (result.length > max) throw new ApiError(400, `${label} is too long`);
  return result;
}

function oneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
  fallback?: T[number]
): T[number] {
  if ((value === undefined || value === "") && fallback) return fallback;
  if (typeof value !== "string" || !allowed.includes(value))
    throw new ApiError(400, `${label} is invalid`);
  return value as T[number];
}

function idOf(value: unknown) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new ApiError(400, "Care case is invalid");
  return id;
}

function optionalDate(value: unknown) {
  const date = text(value, "Next action date", 10);
  if (!date) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`))
  )
    throw new ApiError(400, "Next action date is invalid");
  return date;
}

async function listCases(tenantId: string, includeConfidential: boolean) {
  const db = await getDb();
  const rows = await db
    .select({
      id: cfCareCases.id,
      code: cfCareCases.caseCode,
      memberChurchId: cfMembers.churchId,
      personName: cfCareCases.personName,
      personPhone: cfCareCases.personPhone,
      personType: cfCareCases.personType,
      caseType: cfCareCases.caseType,
      source: cfCareCases.source,
      priority: cfCareCases.priority,
      stage: cfCareCases.stage,
      assignedTo: cfCareCases.assignedTo,
      nextActionDate: cfCareCases.nextActionDate,
      summary: cfCareCases.summary,
      sensitiveNotes: cfCareCases.sensitiveNotes,
      isConfidential: cfCareCases.isConfidential,
      status: cfCareCases.status,
      createdAt: cfCareCases.createdAt,
    })
    .from(cfCareCases)
    .where(eq(cfCareCases.tenantId, tenantId))
    .leftJoin(cfMembers, eq(cfCareCases.memberId, cfMembers.id))
    .orderBy(desc(cfCareCases.createdAt));

  const visibleRows = includeConfidential
    ? rows
    : rows.filter((row) => !row.isConfidential);
  const visibleIds = new Set(visibleRows.map((row) => row.id));

  const activities = (
    await db
      .select()
      .from(cfCareActivities)
      .where(eq(cfCareActivities.tenantId, tenantId))
      .orderBy(desc(cfCareActivities.completedAt))
  ).filter((activity) => visibleIds.has(activity.caseId));

  return visibleRows.map((row) => ({
    ...row,
    personPhone: row.personPhone || undefined,
    sensitiveNotes: includeConfidential
      ? row.sensitiveNotes || undefined
      : undefined,
    activities: activities.filter((activity) => activity.caseId === row.id),
  }));
}

export async function GET(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const cases = await listCases(tenantId, true);
      return apiJson({ cases, confidentialAccess: true }, 200, requestId);
    },
    { permission: "care:read" }
  );
}

export async function POST(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<Record<string, unknown>>(request);
      const db = await getDb();

      if (payload.action === "activity") {
        const caseId = idOf(payload.caseId);
        const [careCase] = await db
          .select()
          .from(cfCareCases)
          .where(
            and(
              eq(cfCareCases.id, caseId),
              eq(cfCareCases.tenantId, tenantId)
            )
          )
          .limit(1);
        if (!careCase)
          throw new ApiError(404, "Care case was not found");

        const activityType =
          text(payload.activityType, "Activity type", 80) ||
          "Follow-up";
        const note = text(payload.note, "Follow-up note", 2000, true);
        const outcome = text(payload.outcome, "Outcome", 500);
        const stage = oneOf(payload.stage, STAGES, "Stage", "Follow-up");
        const nextActionDate = optionalDate(payload.nextActionDate);

        await db.insert(cfCareActivities).values({
          tenantId,
          caseId,
          activityType,
          note,
          outcome: outcome || null,
          completedBy: user.fullName,
        });

        await db
          .update(cfCareCases)
          .set({
            stage,
            nextActionDate,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(cfCareCases.id, caseId),
              eq(cfCareCases.tenantId, tenantId)
            )
          );

        await writeTenantAudit(
          tenantId,
          user,
          "care.activity.create",
          "care_case",
          String(caseId),
          `Activity added: ${activityType}`
        );

        const cases = await listCases(tenantId, true);
        return apiJson({ cases }, 201, requestId);
      }

      // Create case
      const personName = text(payload.personName, "Person", 120, true);
      const caseType = text(payload.caseType, "Case type", 120, true);
      const summary = text(payload.summary, "Summary", 2000, true);

      let memberId: number | null = null;
      const memberChurchId = text(
        payload.memberChurchId,
        "Member church ID",
        30
      );
      if (memberChurchId) {
        const [member] = await db
          .select()
          .from(cfMembers)
          .where(
            and(
              eq(cfMembers.churchId, memberChurchId),
              eq(cfMembers.tenantId, tenantId)
            )
          )
          .limit(1);
        if (!member)
          throw new ApiError(400, "Selected member was not found");
        memberId = member.id;
      }

      const code = `CARE-${new Date().toISOString().slice(2, 7).replace("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

      const [created] = await db
        .insert(cfCareCases)
        .values({
          tenantId,
          caseCode: code,
          memberId,
          personName,
          personPhone:
            text(payload.personPhone, "Phone", 40) || null,
          personType: oneOf(
            payload.personType,
            PERSON_TYPES,
            "Person type",
            "Member"
          ),
          caseType,
          source:
            text(payload.source, "Source", 120) || "Church office",
          priority: oneOf(
            payload.priority,
            PRIORITIES,
            "Priority",
            "Normal"
          ),
          stage: oneOf(payload.stage, STAGES, "Stage", "New"),
          assignedTo:
            text(payload.assignedTo, "Assigned team", 120) ||
            "Pastoral Care Team",
          nextActionDate: optionalDate(payload.nextActionDate),
          summary,
          sensitiveNotes: null,
          isConfidential: false,
          createdBy: user.fullName,
        })
        .returning({ id: cfCareCases.id });

      await writeTenantAudit(
        tenantId,
        user,
        "care.case.create",
        "care_case",
        String(created.id),
        `Created case: ${code}`
      );

      const cases = await listCases(tenantId, true);
      const createdCase = cases.find((c) => c.id === created.id);
      return apiJson({ case: createdCase }, 201, requestId);
    },
    { permission: "care:write" }
  );
}

export async function PATCH(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<{ id?: unknown; status?: unknown; stage?: unknown }>(
          request
        );
      const id = idOf(payload.id);
      const status = oneOf(payload.status, STATUSES, "Status", "Open");
      const stage = oneOf(payload.stage, STAGES, "Stage", "Follow-up");

      const db = await getDb();
      const [existing] = await db
        .select()
        .from(cfCareCases)
        .where(
          and(
            eq(cfCareCases.id, id),
            eq(cfCareCases.tenantId, tenantId)
          )
        )
        .limit(1);
      if (!existing)
        throw new ApiError(404, "Care case was not found");

      await db
        .update(cfCareCases)
        .set({
          status,
          stage,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(cfCareCases.id, id),
            eq(cfCareCases.tenantId, tenantId)
          )
        );

      await writeTenantAudit(
        tenantId,
        user,
        "care.case.update",
        "care_case",
        String(id),
        `Status: ${status}, Stage: ${stage}`
      );

      const cases = await listCases(tenantId, true);
      return apiJson({ cases }, 200, requestId);
    },
    { permission: "care:write" }
  );
}
