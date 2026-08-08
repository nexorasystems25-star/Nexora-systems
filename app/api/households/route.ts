import { asc, count, eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  cfHouseholds,
  cfHouseholdMembers,
  cfMembers,
} from "../../../db/schema-platform";
import { withTenantContext, writeTenantAudit } from "../_tenant";
import { ApiError, apiJson, readJson } from "../_security";
import type { PlatformUser } from "../../lib/auth-platform";

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

async function listHouseholds(tenantId: string) {
  const db = await getDb();

  const householdRows = await db
    .select()
    .from(cfHouseholds)
    .where(eq(cfHouseholds.tenantId, tenantId))
    .orderBy(asc(cfHouseholds.name));

  const links = await db
    .select({
      householdId: cfHouseholdMembers.householdId,
      relationship: cfHouseholdMembers.relationship,
      isPrimary: cfHouseholdMembers.isPrimary,
      memberName: cfMembers.name,
    })
    .from(cfHouseholdMembers)
    .where(eq(cfHouseholdMembers.tenantId, tenantId))
    .leftJoin(cfMembers, eq(cfHouseholdMembers.memberId, cfMembers.id));

  return householdRows.map((row) => {
    const householdLinks = links.filter(
      (link) => link.householdId === row.id
    );
    return {
      id: row.id,
      code: row.householdCode,
      name: row.name,
      address: row.address,
      primaryPhone: row.primaryPhone,
      campus: row.campus,
      pastoralZone: row.pastoralZone,
      status: row.status,
      memberCount: householdLinks.length,
      headName:
        householdLinks.find((link) => link.isPrimary)?.memberName ??
        undefined,
    };
  });
}

export async function GET(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const households = await listHouseholds(tenantId);
      return apiJson({ households }, 200, requestId);
    },
    { permission: "families:read" }
  );
}

export async function POST(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<Record<string, unknown>>(request);
      const name = text(payload.name, 160);
      if (!name) throw new ApiError(400, "Household name is required");

      const db = await getDb();
      const headChurchId = text(payload.headChurchId, 30);
      let headId: number | null = null;

      if (headChurchId) {
        const [head] = await db
          .select()
          .from(cfMembers)
          .where(
            and(
              eq(cfMembers.churchId, headChurchId),
              eq(cfMembers.tenantId, tenantId)
            )
          )
          .limit(1);
        if (!head)
          throw new ApiError(
            400,
            "Selected household head was not found"
          );

        const [alreadyLinked] = await db
          .select()
          .from(cfHouseholdMembers)
          .where(eq(cfHouseholdMembers.memberId, head.id))
          .limit(1);
        if (alreadyLinked)
          throw new ApiError(
            409,
            "Selected member already belongs to a household"
          );
        headId = head.id;
      }

      const householdCode = `HH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      const [created] = await db
        .insert(cfHouseholds)
        .values({
          tenantId,
          householdCode,
          name,
          address: text(payload.address, 240),
          primaryPhone: text(payload.primaryPhone, 40),
          campus:
            text(payload.campus, 120) || "Grace Centre",
          pastoralZone:
            text(payload.pastoralZone, 120) || "Unassigned",
        })
        .returning();

      if (headId) {
        await db.insert(cfHouseholdMembers).values({
          tenantId,
          householdId: created.id,
          memberId: headId,
          relationship: "Household head",
          isPrimary: true,
        });
      }

      await writeTenantAudit(
        tenantId,
        user,
        "household.create",
        "household",
        String(created.id),
        `Created household: ${householdCode}`
      );

      const households = await listHouseholds(tenantId);
      const household = households.find(
        (h) => h.id === created.id
      );
      return apiJson({ household }, 201, requestId);
    },
    { permission: "families:write" }
  );
}
