import { asc, count, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { members, volunteerAssignments, volunteers } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validDate = (value: unknown) => {
  const result = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))) throw new ApiError(400, "Assignment date is invalid");
  return result;
};

async function seedIfEmpty(actorId: number, actorName: string) {
  const db = await getDb();
  const [total] = await db.select({ value: count() }).from(volunteers);
  if (total.value) return;
  const memberRows = await db.select().from(members).orderBy(asc(members.id)).limit(3);
  if (!memberRows.length) return;
  await db.insert(volunteers).values(memberRows.map((member, index) => ({
    volunteerCode: `VOL-00${index + 1}`,
    memberId: member.id,
    name: member.name,
    phone: member.phone,
    skills: ["Hospitality, Guest care", "Administration, Stewardship", "Music, Worship"][index] || "General service",
    availability: index === 1 ? "Sundays and midweek" : "Sundays",
    ministryPreference: ["Ushers", "Finance support", "Worship Team"][index] || "General Service",
    safeguardingStatus: index === 2 ? "Verified" : "Not required",
    createdByUserId: actorId,
    createdByName: actorName,
  })));
  const rows = await db.select().from(volunteers).orderBy(asc(volunteers.id));
  if (rows[0]) await db.insert(volunteerAssignments).values({ volunteerId: rows[0].id, assignmentDate: "2026-08-02", serviceName: "Sunday Celebration Service", teamName: "Ushers", role: "Welcome desk", callTime: "07:45", status: "Confirmed", createdByUserId: actorId, createdByName: actorName });
}

async function listVolunteers() {
  const db = await getDb();
  const people = await db.select({
    id: volunteers.id, code: volunteers.volunteerCode, memberChurchId: members.churchId,
    name: volunteers.name, phone: volunteers.phone, skills: volunteers.skills,
    availability: volunteers.availability, ministryPreference: volunteers.ministryPreference,
    safeguardingStatus: volunteers.safeguardingStatus, status: volunteers.status, joinedAt: volunteers.joinedAt,
  }).from(volunteers).leftJoin(members, eq(volunteers.memberId, members.id)).orderBy(asc(volunteers.name));
  const assignments = await db.select().from(volunteerAssignments).orderBy(asc(volunteerAssignments.assignmentDate), asc(volunteerAssignments.callTime));
  return people.map((person) => ({ ...person, assignments: assignments.filter((item) => item.volunteerId === person.id) }));
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load volunteers", async (requestId) => {
    const access = await requirePermission(request, "volunteers.read");
    if (access.response) return access.response;
    await seedIfEmpty(access.user!.id, access.user!.name);
    return apiJson({ volunteers: await listVolunteers() }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to save volunteer record", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "volunteers.manage");
    if (access.response) return access.response;
    const db = await getDb();
    if (payload.action === "assign") {
      const volunteerId = Number(payload.volunteerId);
      if (!Number.isSafeInteger(volunteerId) || volunteerId < 1) throw new ApiError(400, "Select a volunteer");
      const [volunteer] = await db.select().from(volunteers).where(eq(volunteers.id, volunteerId)).limit(1);
      if (!volunteer || volunteer.status !== "Active") throw new ApiError(409, "Only active volunteers can be scheduled");
      const assignmentDate = validDate(payload.assignmentDate);
      const serviceName = clean(payload.serviceName, 160);
      const teamName = clean(payload.teamName, 120);
      const role = clean(payload.role, 120);
      const callTime = clean(payload.callTime, 5);
      if (!serviceName || !teamName || !role || !/^\d{2}:\d{2}$/.test(callTime)) throw new ApiError(400, "Service, team, role and call time are required");
      const [created] = await db.insert(volunteerAssignments).values({ volunteerId, assignmentDate, serviceName, teamName, role, callTime, status: "Assigned", createdByUserId: access.user!.id, createdByName: access.user!.name }).returning({ id: volunteerAssignments.id });
      await writeAudit(access.user!, "volunteer.assignment.created", "volunteer_assignment", created.id, requestId, { volunteerCode: volunteer.volunteerCode, assignmentDate, teamName, role });
      return apiJson({ volunteers: await listVolunteers() }, 201, requestId);
    }
    const memberChurchId = clean(payload.memberChurchId, 30);
    const [member] = await db.select().from(members).where(eq(members.churchId, memberChurchId)).limit(1);
    if (!member) throw new ApiError(404, "Selected member was not found");
    const [existing] = await db.select().from(volunteers).where(eq(volunteers.memberId, member.id)).limit(1);
    if (existing) throw new ApiError(409, "This member already has a volunteer profile");
    const volunteerCode = `VOL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const [created] = await db.insert(volunteers).values({
      volunteerCode, memberId: member.id, name: member.name, phone: member.phone,
      skills: clean(payload.skills, 500), availability: clean(payload.availability, 160) || "Sundays",
      ministryPreference: clean(payload.ministryPreference, 120) || "General Service",
      safeguardingStatus: clean(payload.safeguardingStatus, 40) || "Not required",
      createdByUserId: access.user!.id, createdByName: access.user!.name,
    }).returning({ id: volunteers.id });
    await writeAudit(access.user!, "volunteer.profile.created", "volunteer", created.id, requestId, { volunteerCode, memberChurchId });
    return apiJson({ volunteer: (await listVolunteers()).find((item) => item.id === created.id) }, 201, requestId);
  });
}

export async function PATCH(request: Request) {
  return safeApi(request, "Unable to update volunteer status", async (requestId) => {
    const payload = await readJson<{ id?: unknown; status?: unknown }>(request);
    const access = await requirePermission(request, "volunteers.manage");
    if (access.response) return access.response;
    const id = Number(payload.id);
    if (!Number.isSafeInteger(id) || id < 1 || !["Active", "Paused", "Inactive"].includes(String(payload.status))) throw new ApiError(400, "Volunteer and status are invalid");
    const db = await getDb();
    const [existing] = await db.select().from(volunteers).where(eq(volunteers.id, id)).limit(1);
    if (!existing) throw new ApiError(404, "Volunteer was not found");
    await db.update(volunteers).set({ status: String(payload.status), updatedAt: new Date().toISOString() }).where(eq(volunteers.id, id));
    await writeAudit(access.user!, "volunteer.status_changed", "volunteer", id, requestId, { previousStatus: existing.status, status: String(payload.status) });
    return apiJson({ volunteers: await listVolunteers() }, 200, requestId);
  });
}
