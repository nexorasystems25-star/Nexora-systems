import { and, asc, count, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  cfAttendanceSessions,
  cfAttendanceRecords,
  cfMembers,
} from "../../../db/schema-platform";
import { withTenantContext, writeTenantAudit } from "../_tenant";
import { ApiError, apiJson, readJson } from "../_security";
import type { PlatformUser } from "../../lib/auth-platform";

// ============================================================================
// ATTENDANCE API - Tenant-Scoped
// ============================================================================
// All queries are now filtered by tenant_id
// ============================================================================

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const idOf = (value: unknown) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new ApiError(400, "Select a valid service session");
  return id;
};
const validDate = (value: unknown) => {
  const date = text(value, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`))
  )
    throw new ApiError(400, "Service date is invalid");
  return date;
};

async function listSessions(tenantId: string) {
  const db = await getDb();
  const sessions = await db
    .select()
    .from(cfAttendanceSessions)
    .where(eq(cfAttendanceSessions.tenantId, tenantId))
    .orderBy(
      desc(cfAttendanceSessions.serviceDate),
      desc(cfAttendanceSessions.startTime)
    );

  const records = await db
    .select({
      id: cfAttendanceRecords.id,
      sessionId: cfAttendanceRecords.sessionId,
      memberId: cfAttendanceRecords.memberId,
      churchId: cfMembers.churchId,
      memberName: cfMembers.name,
      initials: cfMembers.initials,
      personType: cfAttendanceRecords.personType,
      visitorName: cfAttendanceRecords.visitorName,
      attendanceStatus: cfAttendanceRecords.attendanceStatus,
      checkInMethod: cfAttendanceRecords.checkInMethod,
      checkedInAt: cfAttendanceRecords.checkedInAt,
    })
    .from(cfAttendanceRecords)
    .where(eq(cfAttendanceRecords.tenantId, tenantId))
    .leftJoin(cfMembers, eq(cfAttendanceRecords.memberId, cfMembers.id))
    .orderBy(desc(cfAttendanceRecords.checkedInAt));

  return sessions.map((session) => {
    const sessionRecords = records.filter(
      (record) => record.sessionId === session.id
    );
    return {
      id: session.id,
      code: session.sessionCode,
      title: session.title,
      serviceType: session.serviceType,
      serviceDate: session.serviceDate,
      startTime: session.startTime,
      campus: session.campus,
      venue: session.venue,
      status: session.status,
      expectedCount: session.expectedCount,
      memberCount: sessionRecords.filter(
        (record) => record.personType === "Member"
      ).length,
      visitorCount: sessionRecords.filter(
        (record) => record.personType === "Visitor"
      ).length,
      records: sessionRecords.map((record) => ({
        id: record.id,
        memberId: record.memberId,
        churchId: record.churchId,
        name:
          record.personType === "Visitor"
            ? record.visitorName || "Guest visitor"
            : record.memberName || "Former member",
        initials:
          record.personType === "Visitor"
            ? "GV"
            : record.initials || "FM",
        personType: record.personType,
        attendanceStatus: record.attendanceStatus,
        checkInMethod: record.checkInMethod,
        checkedInAt: record.checkedInAt,
      })),
    };
  });
}

export async function GET(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const sessions = await listSessions(tenantId);
      return apiJson({ sessions }, 200, requestId);
    },
    { permission: "attendance:read" }
  );
}

export async function POST(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload = await readJson<Record<string, unknown>>(request);
      const db = await getDb();

      if (payload.action === "create-session") {
        const title = text(payload.title, 160);
        const serviceDate = validDate(payload.serviceDate);
        const startTime = text(payload.startTime, 5);
        if (!title || !/^\d{2}:\d{2}$/.test(startTime))
          throw new ApiError(
            400,
            "Title and a valid start time are required"
          );
        const expectedCount = Number(payload.expectedCount || 0);
        if (
          !Number.isSafeInteger(expectedCount) ||
          expectedCount < 0 ||
          expectedCount > 100_000
        )
          throw new ApiError(400, "Expected attendance is invalid");

        const sessionCode = `ATT-${serviceDate.replaceAll("-", "").slice(2)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

        const [created] = await db
          .insert(cfAttendanceSessions)
          .values({
            tenantId,
            sessionCode,
            title,
            serviceDate: new Date(`${serviceDate}T00:00:00Z`),
            startTime,
            serviceType: text(payload.serviceType, 80) || "Sunday Service",
            campus:
              text(payload.campus, 120) || "Grace Centre",
            venue:
              text(payload.venue, 160) || "Main Auditorium",
            expectedCount,
            status: "Open",
          })
          .returning({ id: cfAttendanceSessions.id });

        await writeTenantAudit(
          tenantId,
          user,
          "attendance.session.create",
          "attendance_session",
          String(created.id),
          `Created session: ${sessionCode}`
        );

        const sessions = await listSessions(tenantId);
        const session = sessions.find((s) => s.code === sessionCode);
        return apiJson({ session }, 201, requestId);
      }

      // Check-in
      const sessionId = idOf(payload.sessionId);
      const [targetSession] = await db
        .select()
        .from(cfAttendanceSessions)
        .where(
          and(
            eq(cfAttendanceSessions.id, sessionId),
            eq(cfAttendanceSessions.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!targetSession)
        throw new ApiError(404, "Service session was not found");
      if (targetSession.status !== "Open")
        throw new ApiError(
          409,
          "This service session is not open for check-in"
        );

      const personType =
        payload.personType === "Visitor" ? "Visitor" : "Member";
      const attendanceStatus = ["Present", "Late", "Excused"].includes(
        String(payload.attendanceStatus)
      )
        ? String(payload.attendanceStatus)
        : "Present";

      if (personType === "Visitor") {
        const visitorName =
          text(payload.visitorName, 120) || "Guest visitor";
        await db.insert(cfAttendanceRecords).values({
          tenantId,
          sessionId,
          personType: "Visitor",
          visitorName,
          attendanceStatus,
          checkInMethod: "Manual",
        });
        await writeTenantAudit(
          tenantId,
          user,
          "attendance.visitor.checkin",
          "attendance_session",
          String(sessionId),
          `Visitor checked in: ${attendanceStatus}`
        );
      } else {
        const churchId = text(payload.churchId, 30);
        const [member] = await db
          .select()
          .from(cfMembers)
          .where(
            and(
              eq(cfMembers.churchId, churchId),
              eq(cfMembers.tenantId, tenantId)
            )
          )
          .limit(1);
        if (!member)
          throw new ApiError(404, "Member record was not found");

        const [existing] = await db
          .select()
          .from(cfAttendanceRecords)
          .where(
            and(
              eq(cfAttendanceRecords.sessionId, sessionId),
              eq(cfAttendanceRecords.memberId, member.id)
            )
          )
          .limit(1);
        if (existing)
          throw new ApiError(
            409,
            `${member.name} is already checked in`
          );

        const checkInMethod = ["Manual", "QR", "Mobile"].includes(
          String(payload.checkInMethod)
        )
          ? String(payload.checkInMethod)
          : "Manual";

        await db.insert(cfAttendanceRecords).values({
          tenantId,
          sessionId,
          memberId: member.id,
          personType: "Member",
          attendanceStatus,
          checkInMethod,
        });
        await writeTenantAudit(
          tenantId,
          user,
          "attendance.member.checkin",
          "attendance_session",
          String(sessionId),
          `Member checked in: ${member.name} (${attendanceStatus})`
        );
      }

      const sessions = await listSessions(tenantId);
      const session = sessions.find((s) => s.id === sessionId);
      return apiJson({ session }, 201, requestId);
    },
    { permission: "attendance:manage" }
  );
}

export async function PATCH(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<{ sessionId?: unknown; status?: unknown }>(request);
      const sessionId = idOf(payload.sessionId);
      if (
        !["Open", "Completed"].includes(String(payload.status))
      )
        throw new ApiError(
          400,
          "A valid session status is required"
        );

      const db = await getDb();
      const [existing] = await db
        .select()
        .from(cfAttendanceSessions)
        .where(
          and(
            eq(cfAttendanceSessions.id, sessionId),
            eq(cfAttendanceSessions.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existing)
        throw new ApiError(404, "Service session was not found");

      await db
        .update(cfAttendanceSessions)
        .set({ status: String(payload.status) })
        .where(
          and(
            eq(cfAttendanceSessions.id, sessionId),
            eq(cfAttendanceSessions.tenantId, tenantId)
          )
        );

      await writeTenantAudit(
        tenantId,
        user,
        "attendance.session.status_change",
        "attendance_session",
        String(sessionId),
        `Status changed: ${existing.status} → ${String(payload.status)}`
      );

      const sessions = await listSessions(tenantId);
      const session = sessions.find((s) => s.id === sessionId);
      return apiJson({ session }, 200, requestId);
    },
    { permission: "attendance:manage" }
  );
}
