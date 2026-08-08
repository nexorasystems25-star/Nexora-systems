import { and, asc, desc, eq, gte } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  attendanceRecords,
  attendanceSessions,
  churchEvents,
  householdMembers,
  households,
  members,
} from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function linkedMember(request: Request, permission: string) {
  const access = await requirePermission(request, permission);
  if (access.response) return { access, member: null };
  if (!access.user!.memberId) throw new ApiError(403, "This account is not linked to a member profile");
  const db = await getDb();
  const [member] = await db.select().from(members).where(and(eq(members.id, access.user!.memberId), eq(members.status, "Active"))).limit(1);
  if (!member) throw new ApiError(404, "Your active member profile was not found");
  return { access, member };
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load member portal", async (requestId) => {
    const { access, member } = await linkedMember(request, "portal.read");
    if (access.response) return access.response;
    const db = await getDb();
    const attendance = await db.select({
      id: attendanceRecords.id,
      title: attendanceSessions.title,
      serviceDate: attendanceSessions.serviceDate,
      startTime: attendanceSessions.startTime,
      venue: attendanceSessions.venue,
      status: attendanceRecords.attendanceStatus,
      checkedInAt: attendanceRecords.checkedInAt,
    }).from(attendanceRecords).innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
      .where(eq(attendanceRecords.memberId, member!.id)).orderBy(desc(attendanceSessions.serviceDate)).limit(12);
    const today = new Date().toISOString().slice(0, 10);
    const events = await db.select({
      id: churchEvents.id, title: churchEvents.title, eventType: churchEvents.eventType,
      startDate: churchEvents.startDate, startTime: churchEvents.startTime,
      venue: churchEvents.venue, campus: churchEvents.campus, status: churchEvents.status,
    }).from(churchEvents).where(gte(churchEvents.startDate, today)).orderBy(asc(churchEvents.startDate)).limit(8);
    const householdLinks = await db.select({
      id: householdMembers.id, relationship: householdMembers.relationship,
      householdId: households.id, householdName: households.name,
      householdCode: households.householdCode, pastoralZone: households.pastoralZone,
    }).from(householdMembers).innerJoin(households, eq(householdMembers.householdId, households.id))
      .where(eq(householdMembers.memberId, member!.id)).limit(1);
    return apiJson({
      profile: {
        churchId: member!.churchId, name: member!.name, initials: member!.initials,
        email: member!.email, phone: member!.phone, address: member!.address,
        group: member!.groupName, membershipType: member!.membershipType,
        baptismStatus: member!.baptismStatus, status: member!.status,
        joinedAt: member!.joinedAt, profilePhotoUrl: member!.profilePhotoKey ? `/api/member-photo?id=${member!.id}` : null,
      },
      attendance,
      events,
      household: householdLinks[0] ?? null,
    }, 200, requestId);
  });
}

export async function PATCH(request: Request) {
  return safeApi(request, "Unable to update member profile", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const { access, member } = await linkedMember(request, "portal.profile.update");
    if (access.response) return access.response;
    const phone = clean(payload.phone, 40);
    const address = clean(payload.address, 240);
    if (!phone) throw new ApiError(400, "Phone number is required");
    const db = await getDb();
    await db.update(members).set({ phone, address }).where(eq(members.id, member!.id));
    await writeAudit(access.user!, "member.portal.profile_updated", "member", member!.id, requestId, {
      fields: ["phone", "address"],
    });
    return apiJson({ updated: true, phone, address }, 200, requestId);
  });
}
