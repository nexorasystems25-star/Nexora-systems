import { asc, count, eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  cfVolunteers,
  cfVolunteerAssignments,
  cfMembers,
} from "../../../db/schema-platform";
import { withTenantContext, writeTenantAudit } from "../_tenant";
import { ApiError, apiJson, readJson } from "../_security";
import type { PlatformUser } from "../../lib/auth-platform";

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const validDate = (value: unknown) => {
  const result = clean(value, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    Number.isNaN(Date.parse(`${result}T00:00:00Z`))
  )
    throw new ApiError(400, "Assignment date is invalid");
  return result;
};

async function listVolunteers(tenantId: string) {
  const db = await getDb();

  const people = await db
    .select({
      id: cfVolunteers.id,
      code: cfVolunteers.volunteerCode,
      memberChurchId: cfMembers.churchId,
      name: cfVolunteers.name,
      phone: cfVolunteers.phone,
      skills: cfVolunteers.skills,
      availability: cfVolunteers.availability,
      ministryPreference: cfVolunteers.ministryPreference,
      safeguardingStatus: cfVolunteers.safeguardingStatus,
      status: cfVolunteers.status,
      joinedAt: cfVolunteers.joinedAt,
    })
    .from(cfVolunteers)
    .where(eq(cfVolunteers.tenantId, tenantId))
    .leftJoin(cfMembers, eq(cfVolunteers.memberId, cfMembers.id))
    .orderBy(asc(cfVolunteers.name));

  const assignments = await db
    .select()
    .from(cfVolunteerAssignments)
    .where(eq(cfVolunteerAssignments.tenantId, tenantId))
    .orderBy(
      asc(cfVolunteerAssignments.assignmentDate),
      asc(cfVolunteerAssignments.callTime)
    );

  return people.map((person) => ({
    ...person,
    assignments: assignments.filter(
      (item) => item.volunteerId === person.id
    ),
  }));
}

export async function GET(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const volunteers = await listVolunteers(tenantId);
      return apiJson({ volunteers }, 200, requestId);
    },
    { permission: "volunteers:read" }
  );
}

export async function POST(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<Record<string, unknown>>(request);
      const db = await getDb();

      if (payload.action === "assign") {
        const volunteerId = Number(payload.volunteerId);
        if (!Number.isSafeInteger(volunteerId) || volunteerId < 1)
          throw new ApiError(400, "Select a volunteer");

        const [volunteer] = await db
          .select()
          .from(cfVolunteers)
          .where(
            and(
              eq(cfVolunteers.id, volunteerId),
              eq(cfVolunteers.tenantId, tenantId)
            )
          )
          .limit(1);
        if (!volunteer || volunteer.status !== "Active")
          throw new ApiError(
            409,
            "Only active volunteers can be scheduled"
          );

        const assignmentDate = validDate(payload.assignmentDate);
        const serviceName = clean(payload.serviceName, 160);
        const teamName = clean(payload.teamName, 120);
        const role = clean(payload.role, 120);
        const callTime = clean(payload.callTime, 5);
        if (
          !serviceName ||
          !teamName ||
          !role ||
          !/^\d{2}:\d{2}$/.test(callTime)
        )
          throw new ApiError(
            400,
            "Service, team, role and call time are required"
          );

        const [created] = await db
          .insert(cfVolunteerAssignments)
          .values({
            tenantId,
            volunteerId,
            assignmentDate,
            serviceName,
            teamName,
            role,
            callTime,
            status: "Assigned",
            createdByUserId: user.identityId,
            createdByName: user.fullName,
          })
          .returning({ id: cfVolunteerAssignments.id });

        await writeTenantAudit(
          tenantId,
          user,
          "volunteer.assignment.create",
          "volunteer_assignment",
          String(created.id),
          `Assignment: ${teamName} / ${role}`
        );

        const volunteers = await listVolunteers(tenantId);
        return apiJson({ volunteers }, 201, requestId);
      }

      // Create volunteer profile
      const memberChurchId = clean(payload.memberChurchId, 30);
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
        throw new ApiError(404, "Selected member was not found");

      const [existing] = await db
        .select()
        .from(cfVolunteers)
        .where(eq(cfVolunteers.memberId, member.id))
        .limit(1);
      if (existing)
        throw new ApiError(
          409,
          "This member already has a volunteer profile"
        );

      const volunteerCode = `VOL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      const [created] = await db
        .insert(cfVolunteers)
        .values({
          tenantId,
          volunteerCode,
          memberId: member.id,
          name: member.name,
          phone: member.phone,
          skills: clean(payload.skills, 500),
          availability:
            clean(payload.availability, 160) || "Sundays",
          ministryPreference:
            clean(payload.ministryPreference, 120) ||
            "General Service",
          safeguardingStatus:
            clean(payload.safeguardingStatus, 40) ||
            "Not required",
          createdByUserId: user.identityId,
          createdByName: user.fullName,
        })
        .returning({ id: cfVolunteers.id });

      await writeTenantAudit(
        tenantId,
        user,
        "volunteer.create",
        "volunteer",
        String(created.id),
        `Created volunteer: ${volunteerCode}`
      );

      const volunteers = await listVolunteers(tenantId);
      const volunteer = volunteers.find(
        (v) => v.id === created.id
      );
      return apiJson({ volunteer }, 201, requestId);
    },
    { permission: "volunteers:write" }
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
        !["Active", "Paused", "Inactive"].includes(
          String(payload.status)
        )
      )
        throw new ApiError(
          400,
          "Volunteer and status are invalid"
        );

      const db = await getDb();
      const [existing] = await db
        .select()
        .from(cfVolunteers)
        .where(
          and(
            eq(cfVolunteers.id, id),
            eq(cfVolunteers.tenantId, tenantId)
          )
        )
        .limit(1);
      if (!existing)
        throw new ApiError(404, "Volunteer was not found");

      await db
        .update(cfVolunteers)
        .set({
          status: String(payload.status),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(cfVolunteers.id, id),
            eq(cfVolunteers.tenantId, tenantId)
          )
        );

      await writeTenantAudit(
        tenantId,
        user,
        "volunteer.status_change",
        "volunteer",
        String(id),
        `Status: ${existing.status} → ${String(payload.status)}`
      );

      const volunteers = await listVolunteers(tenantId);
      return apiJson({ volunteers }, 200, requestId);
    },
    { permission: "volunteers:write" }
  );
}
