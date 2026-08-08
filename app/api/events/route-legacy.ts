import { asc, count, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { attendanceSessions, churchEvents, eventAssignments, eventProgrammeItems } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validDate = (value: unknown) => {
  const date = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new ApiError(400, "Event date is invalid");
  return date;
};

async function seedIfEmpty() {
  const db = await getDb();
  const [result] = await db.select({ value: count() }).from(churchEvents);
  if (result.value) return;
  await db.insert(churchEvents).values([
    { eventCode: "EVT-260802-01", title: "Sunday Celebration Service", eventType: "Service", startDate: "2026-08-02", startTime: "08:30", endTime: "11:00", coordinator: "Pastor Daniel Asante", expectedAttendance: 420, status: "Ready" },
    { eventCode: "EVT-260805-02", title: "Midweek Bible Teaching", eventType: "Service", startDate: "2026-08-05", startTime: "18:00", endTime: "19:30", venue: "Chapel", coordinator: "Rev. Lydia Owusu", expectedAttendance: 180, status: "Planning" },
    { eventCode: "EVT-260809-03", title: "Youth Empowerment Summit", eventType: "Conference", startDate: "2026-08-09", startTime: "10:00", endTime: "16:00", coordinator: "Priscilla Agyeman", expectedAttendance: 260, status: "Planning" },
  ]);
  const events = await db.select().from(churchEvents).orderBy(asc(churchEvents.id));
  if (events[0]) {
    await db.insert(eventProgrammeItems).values([
      { eventId: events[0].id, sequence: 1, title: "Opening prayer", owner: "Prayer Team", durationMinutes: 10 },
      { eventId: events[0].id, sequence: 2, title: "Praise and worship", owner: "Worship Team", durationMinutes: 35 },
      { eventId: events[0].id, sequence: 3, title: "Church announcements", owner: "Communications", durationMinutes: 10 },
      { eventId: events[0].id, sequence: 4, title: "Sermon and ministry", owner: "Pastor Daniel Asante", durationMinutes: 55 },
    ]);
    await db.insert(eventAssignments).values([
      { eventId: events[0].id, teamName: "Ushers", leaderName: "Kwame Owusu", requiredCount: 12, confirmedCount: 10, status: "Partial" },
      { eventId: events[0].id, teamName: "Worship Team", leaderName: "Emmanuel Frimpong", requiredCount: 8, confirmedCount: 8, status: "Confirmed" },
      { eventId: events[0].id, teamName: "Media Team", leaderName: "Nana Boakye", requiredCount: 6, confirmedCount: 5, status: "Partial" },
    ]);
  }
}

async function listEvents() {
  const db = await getDb();
  const events = await db.select().from(churchEvents).orderBy(asc(churchEvents.startDate), asc(churchEvents.startTime));
  const programme = await db.select().from(eventProgrammeItems).orderBy(asc(eventProgrammeItems.sequence));
  const assignments = await db.select().from(eventAssignments).orderBy(asc(eventAssignments.teamName));
  return events.map((event) => ({
    id: event.id, code: event.eventCode, title: event.title, eventType: event.eventType,
    startDate: event.startDate, startTime: event.startTime, endTime: event.endTime || undefined,
    campus: event.campus, venue: event.venue, coordinator: event.coordinator,
    expectedAttendance: event.expectedAttendance, status: event.status,
    attendanceSessionId: event.attendanceSessionId, notes: event.notes || undefined,
    programme: programme.filter((item) => item.eventId === event.id),
    assignments: assignments.filter((item) => item.eventId === event.id),
  }));
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load events", async (requestId) => {
    const access = await requirePermission(request, "events.read");
    if (access.response) return access.response;
    await seedIfEmpty();
    return apiJson({ events: await listEvents() }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to create event", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "events.manage");
    if (access.response) return access.response;
    const title = text(payload.title, 160);
    const startDate = validDate(payload.startDate);
    const startTime = text(payload.startTime, 5);
    if (!title || !/^\d{2}:\d{2}$/.test(startTime)) throw new ApiError(400, "Title and a valid start time are required");
    const expectedAttendance = Number(payload.expectedAttendance || 0);
    if (!Number.isSafeInteger(expectedAttendance) || expectedAttendance < 0 || expectedAttendance > 100_000) throw new ApiError(400, "Expected attendance is invalid");
    const db = await getDb();
    const code = `EVT-${startDate.replaceAll("-", "").slice(2)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    let attendanceSessionId: number | null = null;
    if (payload.createAttendance) {
      const sessionCode = `ATT-${startDate.replaceAll("-", "").slice(2)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const [session] = await db.insert(attendanceSessions).values({ sessionCode, title, serviceType: text(payload.eventType, 80) || "Service", serviceDate: startDate, startTime, campus: text(payload.campus, 120) || "Grace Centre", venue: text(payload.venue, 160) || "Main Auditorium", expectedCount: expectedAttendance, status: "Scheduled" }).returning({ id: attendanceSessions.id });
      attendanceSessionId = session.id;
    }
    const [created] = await db.insert(churchEvents).values({
      eventCode: code, title, eventType: text(payload.eventType, 80) || "Service", startDate, startTime,
      endTime: text(payload.endTime, 5) || null, campus: text(payload.campus, 120) || "Grace Centre",
      venue: text(payload.venue, 160) || "Main Auditorium", coordinator: text(payload.coordinator, 120) || "Unassigned",
      expectedAttendance, notes: text(payload.notes, 2000) || null,
      attendanceSessionId, status: "Planning",
    }).returning({ id: churchEvents.id });
    await writeAudit(access.user!, "event.created", "church_event", created.id, requestId, { code, startDate, attendanceSessionCreated: Boolean(attendanceSessionId) });
    const [event] = (await listEvents()).filter((item) => item.code === code);
    return apiJson({ event }, 201, requestId);
  });
}

export async function PATCH(request: Request) {
  return safeApi(request, "Unable to update event", async (requestId) => {
    const payload = await readJson<{ id?: unknown; status?: unknown }>(request);
    const access = await requirePermission(request, "events.manage");
    if (access.response) return access.response;
    const id = Number(payload.id);
    if (!Number.isSafeInteger(id) || id < 1 || !["Planning", "Ready", "Completed", "Cancelled"].includes(String(payload.status))) throw new ApiError(400, "A valid event status is required");
    const db = await getDb();
    const [existing] = await db.select().from(churchEvents).where(eq(churchEvents.id, id)).limit(1);
    if (!existing) throw new ApiError(404, "Event was not found");
    await db.update(churchEvents).set({ status: String(payload.status) }).where(eq(churchEvents.id, id));
    await writeAudit(access.user!, "event.status_changed", "church_event", id, requestId, { previousStatus: existing.status, status: String(payload.status) });
    const [event] = (await listEvents()).filter((item) => item.id === id);
    return apiJson({ event }, 200, requestId);
  });
}
