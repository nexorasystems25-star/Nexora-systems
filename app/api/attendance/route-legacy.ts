import { and, asc, count, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { attendanceRecords, attendanceSessions, members } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const idOf = (value: unknown) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "Select a valid service session");
  return id;
};
const validDate = (value: unknown) => {
  const date = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new ApiError(400, "Service date is invalid");
  return date;
};

async function seedIfEmpty() {
  const db = await getDb();
  const [result] = await db.select({ value: count() }).from(attendanceSessions);
  if (result.value > 0) return;
  await db.insert(attendanceSessions).values([
    { sessionCode: "ATT-260802-01", title: "Sunday Celebration Service", serviceDate: "2026-08-02", startTime: "08:30", status: "Open", expectedCount: 420 },
    { sessionCode: "ATT-260729-01", title: "Midweek Bible Teaching", serviceType: "Midweek Service", serviceDate: "2026-07-29", startTime: "18:00", venue: "Chapel", status: "Completed", expectedCount: 180 },
    { sessionCode: "ATT-260726-01", title: "Sunday Celebration Service", serviceDate: "2026-07-26", startTime: "08:30", status: "Completed", expectedCount: 400 },
  ]);
  const [openSession] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.status, "Open")).limit(1);
  const memberRows = await db.select().from(members).orderBy(asc(members.id)).limit(3);
  if (openSession && memberRows.length) {
    await db.insert(attendanceRecords).values(memberRows.map((member, index) => ({
      sessionId: openSession.id,
      memberId: member.id,
      attendanceStatus: index === 2 ? "Late" : "Present",
      checkInMethod: "Manual",
    })));
  }
}

async function listSessions() {
  const db = await getDb();
  const sessions = await db.select().from(attendanceSessions).orderBy(desc(attendanceSessions.serviceDate), desc(attendanceSessions.startTime));
  const records = await db.select({
    id: attendanceRecords.id,
    sessionId: attendanceRecords.sessionId,
    memberId: attendanceRecords.memberId,
    churchId: members.churchId,
    memberName: members.name,
    initials: members.initials,
    personType: attendanceRecords.personType,
    visitorName: attendanceRecords.visitorName,
    attendanceStatus: attendanceRecords.attendanceStatus,
    checkInMethod: attendanceRecords.checkInMethod,
    checkedInAt: attendanceRecords.checkedInAt,
  }).from(attendanceRecords).leftJoin(members, eq(attendanceRecords.memberId, members.id)).orderBy(desc(attendanceRecords.checkedInAt));
  return sessions.map((session) => {
    const sessionRecords = records.filter((record) => record.sessionId === session.id);
    return {
      id: session.id, code: session.sessionCode, title: session.title, serviceType: session.serviceType,
      serviceDate: session.serviceDate, startTime: session.startTime, campus: session.campus, venue: session.venue,
      status: session.status, expectedCount: session.expectedCount,
      memberCount: sessionRecords.filter((record) => record.personType === "Member").length,
      visitorCount: sessionRecords.filter((record) => record.personType === "Visitor").length,
      records: sessionRecords.map((record) => ({
        id: record.id, memberId: record.memberId, churchId: record.churchId,
        name: record.personType === "Visitor" ? record.visitorName || "Guest visitor" : record.memberName || "Former member",
        initials: record.personType === "Visitor" ? "GV" : record.initials || "FM",
        personType: record.personType, attendanceStatus: record.attendanceStatus,
        checkInMethod: record.checkInMethod, checkedInAt: record.checkedInAt,
      })),
    };
  });
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load attendance", async (requestId) => {
    const access = await requirePermission(request, "attendance.read");
    if (access.response) return access.response;
    await seedIfEmpty();
    return apiJson({ sessions: await listSessions() }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to record attendance", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "attendance.manage");
    if (access.response) return access.response;
    const db = await getDb();
    if (payload.action === "create-session") {
      const title = text(payload.title, 160);
      const serviceDate = validDate(payload.serviceDate);
      const startTime = text(payload.startTime, 5);
      if (!title || !/^\d{2}:\d{2}$/.test(startTime)) throw new ApiError(400, "Title and a valid start time are required");
      const expectedCount = Number(payload.expectedCount || 0);
      if (!Number.isSafeInteger(expectedCount) || expectedCount < 0 || expectedCount > 100_000) throw new ApiError(400, "Expected attendance is invalid");
      const sessionCode = `ATT-${serviceDate.replaceAll("-", "").slice(2)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const [created] = await db.insert(attendanceSessions).values({
        sessionCode, title, serviceDate, startTime,
        serviceType: text(payload.serviceType, 80) || "Sunday Service",
        campus: text(payload.campus, 120) || "Grace Centre", venue: text(payload.venue, 160) || "Main Auditorium",
        expectedCount, status: "Open",
      }).returning({ id: attendanceSessions.id });
      const [session] = (await listSessions()).filter((item) => item.code === sessionCode);
      await writeAudit(access.user!, "attendance.session.created", "attendance_session", created.id, requestId, { sessionCode, serviceDate });
      return apiJson({ session }, 201, requestId);
    }
    const sessionId = idOf(payload.sessionId);
    const [targetSession] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.id, sessionId)).limit(1);
    if (!targetSession) throw new ApiError(404, "Service session was not found");
    if (targetSession.status !== "Open") throw new ApiError(409, "This service session is not open for check-in");
    const personType = payload.personType === "Visitor" ? "Visitor" : "Member";
    const attendanceStatus = ["Present", "Late", "Excused"].includes(String(payload.attendanceStatus)) ? String(payload.attendanceStatus) : "Present";
    if (personType === "Visitor") {
      const visitorName = text(payload.visitorName, 120) || "Guest visitor";
      await db.insert(attendanceRecords).values({ sessionId, personType: "Visitor", visitorName, attendanceStatus, checkInMethod: "Manual" });
      await writeAudit(access.user!, "attendance.visitor.checked_in", "attendance_session", sessionId, requestId, { attendanceStatus });
    } else {
      const churchId = text(payload.churchId, 30);
      const [member] = await db.select().from(members).where(eq(members.churchId, churchId)).limit(1);
      if (!member) throw new ApiError(404, "Member record was not found");
      const [existing] = await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.sessionId, sessionId), eq(attendanceRecords.memberId, member.id))).limit(1);
      if (existing) throw new ApiError(409, `${member.name} is already checked in`);
      const checkInMethod = ["Manual", "QR", "Mobile"].includes(String(payload.checkInMethod)) ? String(payload.checkInMethod) : "Manual";
      await db.insert(attendanceRecords).values({ sessionId, memberId: member.id, personType: "Member", attendanceStatus, checkInMethod });
      await writeAudit(access.user!, "attendance.member.checked_in", "attendance_session", sessionId, requestId, { memberChurchId: member.churchId, attendanceStatus, checkInMethod });
    }
    const [session] = (await listSessions()).filter((item) => item.id === sessionId);
    return apiJson({ session }, 201, requestId);
  });
}

export async function PATCH(request: Request) {
  return safeApi(request, "Unable to update service session", async (requestId) => {
    const payload = await readJson<{ sessionId?: unknown; status?: unknown }>(request);
    const access = await requirePermission(request, "attendance.manage");
    if (access.response) return access.response;
    const sessionId = idOf(payload.sessionId);
    if (!["Open", "Completed"].includes(String(payload.status))) throw new ApiError(400, "A valid session status is required");
    const db = await getDb();
    const [existing] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.id, sessionId)).limit(1);
    if (!existing) throw new ApiError(404, "Service session was not found");
    await db.update(attendanceSessions).set({ status: String(payload.status) }).where(eq(attendanceSessions.id, sessionId));
    await writeAudit(access.user!, "attendance.session.status_changed", "attendance_session", sessionId, requestId, { previousStatus: existing.status, status: String(payload.status) });
    const [session] = (await listSessions()).filter((item) => item.id === sessionId);
    return apiJson({ session }, 200, requestId);
  });
}
