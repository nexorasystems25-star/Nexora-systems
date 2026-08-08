import { asc, count, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { leadershipAppointments, members } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

const LEVELS = ["Executive", "Pastoral", "Department", "Ministry", "Fellowship"] as const;
const STATUSES = ["Active", "On leave", "Completed"] as const;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const date = (value: unknown, required = false) => {
  const result = clean(value, 10);
  if (!result && !required) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))) throw new ApiError(400, "Enter a valid appointment date");
  return result;
};

async function seedIfEmpty(actorId: number, actorName: string) {
  const db = await getDb();
  const [total] = await db.select({ value: count() }).from(leadershipAppointments);
  if (total.value) return;
  const memberRows = await db.select().from(members).orderBy(asc(members.id));
  await db.insert(leadershipAppointments).values([
    { appointmentCode: "LDR-001", memberId: memberRows[0]?.id, leaderName: memberRows[0]?.name || "Akosua Mensah", title: "Women’s Ministry President", leadershipLevel: "Ministry", ministry: "Women’s Ministry", campus: "Grace Centre", startDate: "2025-01-01", status: "Active", createdByUserId: actorId, createdByName: actorName },
    { appointmentCode: "LDR-002", memberId: memberRows[1]?.id, leaderName: memberRows[1]?.name || "Kwame Owusu", title: "Head Usher", leadershipLevel: "Department", ministry: "Ushers", campus: "Grace Centre", startDate: "2025-06-01", status: "Active", createdByUserId: actorId, createdByName: actorName },
  ]);
}

async function listAppointments() {
  const db = await getDb();
  return db.select({
    id: leadershipAppointments.id,
    code: leadershipAppointments.appointmentCode,
    memberChurchId: members.churchId,
    leaderName: leadershipAppointments.leaderName,
    title: leadershipAppointments.title,
    leadershipLevel: leadershipAppointments.leadershipLevel,
    ministry: leadershipAppointments.ministry,
    campus: leadershipAppointments.campus,
    startDate: leadershipAppointments.startDate,
    termEndDate: leadershipAppointments.termEndDate,
    status: leadershipAppointments.status,
    createdByName: leadershipAppointments.createdByName,
    createdAt: leadershipAppointments.createdAt,
  }).from(leadershipAppointments).leftJoin(members, eq(leadershipAppointments.memberId, members.id)).orderBy(asc(leadershipAppointments.leadershipLevel), asc(leadershipAppointments.leaderName));
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load leadership records", async (requestId) => {
    const access = await requirePermission(request, "leadership.read");
    if (access.response) return access.response;
    await seedIfEmpty(access.user!.id, access.user!.name);
    return apiJson({ appointments: await listAppointments() }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to create leadership appointment", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "leadership.manage");
    if (access.response) return access.response;
    const memberChurchId = clean(payload.memberChurchId, 30);
    const title = clean(payload.title, 140);
    const ministry = clean(payload.ministry, 140);
    const leadershipLevel = typeof payload.leadershipLevel === "string" && LEVELS.includes(payload.leadershipLevel as typeof LEVELS[number]) ? payload.leadershipLevel : "";
    if (!memberChurchId || !title || !ministry || !leadershipLevel) throw new ApiError(400, "Member, title, leadership level and ministry are required");
    const db = await getDb();
    const [member] = await db.select().from(members).where(eq(members.churchId, memberChurchId)).limit(1);
    if (!member) throw new ApiError(404, "Selected member was not found");
    const appointmentCode = `LDR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const [created] = await db.insert(leadershipAppointments).values({
      appointmentCode,
      memberId: member.id,
      leaderName: member.name,
      title,
      leadershipLevel,
      ministry,
      campus: clean(payload.campus, 120) || "Grace Centre",
      startDate: date(payload.startDate, true)!,
      termEndDate: date(payload.termEndDate),
      status: "Active",
      createdByUserId: access.user!.id,
      createdByName: access.user!.name,
    }).returning({ id: leadershipAppointments.id });
    await writeAudit(access.user!, "leadership.appointment.created", "leadership_appointment", created.id, requestId, { appointmentCode, memberChurchId, title, ministry });
    return apiJson({ appointment: (await listAppointments()).find((item) => item.id === created.id) }, 201, requestId);
  });
}

export async function PATCH(request: Request) {
  return safeApi(request, "Unable to update leadership appointment", async (requestId) => {
    const payload = await readJson<{ id?: unknown; status?: unknown }>(request);
    const access = await requirePermission(request, "leadership.manage");
    if (access.response) return access.response;
    const id = Number(payload.id);
    if (!Number.isSafeInteger(id) || id < 1 || typeof payload.status !== "string" || !STATUSES.includes(payload.status as typeof STATUSES[number])) throw new ApiError(400, "Appointment and status are invalid");
    const db = await getDb();
    const [existing] = await db.select().from(leadershipAppointments).where(eq(leadershipAppointments.id, id)).limit(1);
    if (!existing) throw new ApiError(404, "Leadership appointment was not found");
    await db.update(leadershipAppointments).set({ status: payload.status, updatedAt: new Date().toISOString() }).where(eq(leadershipAppointments.id, id));
    await writeAudit(access.user!, "leadership.appointment.status_changed", "leadership_appointment", id, requestId, { previousStatus: existing.status, status: payload.status });
    return apiJson({ appointment: (await listAppointments()).find((item) => item.id === id) }, 200, requestId);
  });
}
