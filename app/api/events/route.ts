import { asc, desc, eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  cfChurchEvents,
  cfEventProgrammeItems,
  cfEventAssignments,
  cfAttendanceSessions,
} from "../../../db/schema-platform";
import { withTenantContext, writeTenantAudit } from "../_tenant";
import { ApiError, apiJson, readJson } from "../_security";
import type { PlatformUser } from "../../lib/auth-platform";

// ============================================================================
// EVENTS API - Tenant-Scoped
// ============================================================================
// All queries are now filtered by tenant_id
// ============================================================================

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const validDate = (value: unknown) => {
  const date = text(value, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`))
  )
    throw new ApiError(400, "Event date is invalid");
  return date;
};

async function listEvents(tenantId: string) {
  const db = await getDb();

  const events = await db
    .select()
    .from(cfChurchEvents)
    .where(eq(cfChurchEvents.tenantId, tenantId))
    .orderBy(
      asc(cfChurchEvents.startDate),
      asc(cfChurchEvents.startTime)
    );

  const programme = await db
    .select()
    .from(cfEventProgrammeItems)
    .where(eq(cfEventProgrammeItems.tenantId, tenantId))
    .orderBy(asc(cfEventProgrammeItems.sequence));

  const assignments = await db
    .select()
    .from(cfEventAssignments)
    .where(eq(cfEventAssignments.tenantId, tenantId))
    .orderBy(asc(cfEventAssignments.teamName));

  return events.map((event) => ({
    id: event.id,
    code: event.eventCode,
    title: event.title,
    eventType: event.eventType,
    startDate: event.startDate,
    startTime: event.startTime,
    endTime: event.endTime || undefined,
    campus: event.campus,
    venue: event.venue,
    coordinator: event.coordinator,
    expectedAttendance: event.expectedAttendance,
    status: event.status,
    attendanceSessionId: event.attendanceSessionId,
    notes: event.notes || undefined,
    programme: programme.filter((item) => item.eventId === event.id),
    assignments: assignments.filter((item) => item.eventId === event.id),
  }));
}

export async function GET(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const events = await listEvents(tenantId);
      return apiJson({ events }, 200, requestId);
    },
    { permission: "events:read" }
  );
}

export async function POST(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<Record<string, unknown>>(request);
      const title = text(payload.title, 160);
      const startDate = validDate(payload.startDate);
      const startTime = text(payload.startTime, 5);
      if (!title || !/^\d{2}:\d{2}$/.test(startTime))
        throw new ApiError(
          400,
          "Title and a valid start time are required"
        );

      const expectedAttendance = Number(
        payload.expectedAttendance || 0
      );
      if (
        !Number.isSafeInteger(expectedAttendance) ||
        expectedAttendance < 0 ||
        expectedAttendance > 100_000
      )
        throw new ApiError(400, "Expected attendance is invalid");

      const db = await getDb();
      const code = `EVT-${startDate.replaceAll("-", "").slice(2)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

      let attendanceSessionId: number | null = null;
      if (payload.createAttendance) {
        const sessionCode = `ATT-${startDate.replaceAll("-", "").slice(2)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
        const [session] = await db
          .insert(cfAttendanceSessions)
          .values({
            tenantId,
            sessionCode,
            title,
            serviceType:
              text(payload.eventType, 80) || "Service",
            serviceDate: new Date(`${startDate}T00:00:00Z`),
            startTime,
            campus:
              text(payload.campus, 120) || "Grace Centre",
            venue:
              text(payload.venue, 160) || "Main Auditorium",
            expectedCount: expectedAttendance,
            status: "Scheduled",
          })
          .returning({ id: cfAttendanceSessions.id });
        attendanceSessionId = session.id;
      }

      const [created] = await db
        .insert(cfChurchEvents)
        .values({
          tenantId,
          eventCode: code,
          title,
          eventType:
            text(payload.eventType, 80) || "Service",
          startDate: new Date(`${startDate}T00:00:00Z`),
          startTime,
          endTime: text(payload.endTime, 5) || null,
          campus:
            text(payload.campus, 120) || "Grace Centre",
          venue:
            text(payload.venue, 160) || "Main Auditorium",
          coordinator:
            text(payload.coordinator, 120) || "Unassigned",
          expectedAttendance,
          notes: text(payload.notes, 2000) || null,
          attendanceSessionId,
          status: "Planning",
        })
        .returning({ id: cfChurchEvents.id });

      await writeTenantAudit(
        tenantId,
        user,
        "event.create",
        "church_event",
        String(created.id),
        `Created event: ${code}`
      );

      const events = await listEvents(tenantId);
      const event = events.find((e) => e.code === code);
      return apiJson({ event }, 201, requestId);
    },
    { permission: "events:write" }
  );
}

export async function PATCH(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<{ id?: unknown; status?: unknown }>(request);
      const id = Number(payload.id);
      if (
        !Number.isSafeInteger(id) ||
        id < 1 ||
        !["Planning", "Ready", "Completed", "Cancelled"].includes(
          String(payload.status)
        )
      )
        throw new ApiError(
          400,
          "A valid event status is required"
        );

      const db = await getDb();
      const [existing] = await db
        .select()
        .from(cfChurchEvents)
        .where(
          and(
            eq(cfChurchEvents.id, id),
            eq(cfChurchEvents.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existing)
        throw new ApiError(404, "Event was not found");

      await db
        .update(cfChurchEvents)
        .set({ status: String(payload.status) })
        .where(
          and(
            eq(cfChurchEvents.id, id),
            eq(cfChurchEvents.tenantId, tenantId)
          )
        );

      await writeTenantAudit(
        tenantId,
        user,
        "event.status_change",
        "church_event",
        String(id),
        `Status changed: ${existing.status} → ${String(payload.status)}`
      );

      const events = await listEvents(tenantId);
      const event = events.find((e) => e.id === id);
      return apiJson({ event }, 200, requestId);
    },
    { permission: "events:write" }
  );
}
