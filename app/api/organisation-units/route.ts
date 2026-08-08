import { asc, count, eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import { cfOrganisationUnits } from "../../../db/schema-platform";
import { withTenantContext, writeTenantAudit } from "../_tenant";
import { ApiError, apiJson, readJson } from "../_security";
import type { PlatformUser } from "../../lib/auth-platform";

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const toUnit = (row: typeof cfOrganisationUnits.$inferSelect) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  leaderName: row.leaderName,
  memberCount: row.memberCount,
  meetingSchedule: row.meetingSchedule,
  campus: row.campus,
  status: row.status,
});

export async function GET(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const db = await getDb();
      const rows = await db
        .select()
        .from(cfOrganisationUnits)
        .where(eq(cfOrganisationUnits.tenantId, tenantId))
        .orderBy(asc(cfOrganisationUnits.name));
      return apiJson({ units: rows.map(toUnit) }, 200, requestId);
    },
    { permission: "ministries:read" }
  );
}

export async function POST(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<Record<string, unknown>>(request);
      const name = text(payload.name, 160);
      const type = ["Ministry", "Department", "Fellowship"].includes(
        String(payload.type)
      )
        ? String(payload.type)
        : "Ministry";
      if (!name)
        throw new ApiError(400, "Unit name is required");

      const db = await getDb();
      const [duplicate] = await db
        .select({ id: cfOrganisationUnits.id })
        .from(cfOrganisationUnits)
        .where(
          and(
            eq(cfOrganisationUnits.name, name),
            eq(cfOrganisationUnits.tenantId, tenantId)
          )
        )
        .limit(1);
      if (duplicate)
        throw new ApiError(
          409,
          "A unit with this name already exists"
        );

      const [created] = await db
        .insert(cfOrganisationUnits)
        .values({
          tenantId,
          name,
          type,
          leaderName:
            text(payload.leaderName, 120) || "Unassigned",
          meetingSchedule:
            text(payload.meetingSchedule, 160) ||
            "To be scheduled",
          campus:
            text(payload.campus, 120) || "Grace Centre",
        })
        .returning();

      await writeTenantAudit(
        tenantId,
        user,
        "organisation_unit.create",
        "organisation_unit",
        String(created.id),
        `Created unit: ${name} (${type})`
      );

      return apiJson({ unit: toUnit(created) }, 201, requestId);
    },
    { permission: "ministries:write" }
  );
}
