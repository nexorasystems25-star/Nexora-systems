import { asc, count, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { householdMembers, households, members } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function seedIfEmpty() {
  const db = await getDb();
  const [result] = await db.select({ value: count() }).from(households);
  if (result.value > 0) return;
  await db.insert(households).values([
    { householdCode: "HH-0101", name: "Mensah Household", address: "Ahodwo, Kumasi", primaryPhone: "024 000 1842", campus: "Grace Centre", pastoralZone: "Central Zone" },
    { householdCode: "HH-0102", name: "Owusu Household", address: "Asokwa, Kumasi", primaryPhone: "055 410 8821", campus: "Grace Centre", pastoralZone: "East Zone" },
    { householdCode: "HH-0103", name: "Boateng Household", address: "Santasi, Kumasi", primaryPhone: "020 771 1904", campus: "North Assembly", pastoralZone: "West Zone" },
  ]);
  const householdRows = await db.select().from(households).orderBy(asc(households.id));
  const memberRows = await db.select().from(members).orderBy(asc(members.id));
  const links = householdRows.map((household, index) => memberRows[index] ? ({ householdId: household.id, memberId: memberRows[index].id, relationship: "Household head", isPrimary: true }) : null).filter(Boolean) as (typeof householdMembers.$inferInsert)[];
  if (links.length) await db.insert(householdMembers).values(links);
}

async function listHouseholds() {
  const db = await getDb();
  const householdRows = await db.select().from(households).orderBy(asc(households.name));
  const links = await db.select({
    householdId: householdMembers.householdId,
    relationship: householdMembers.relationship,
    isPrimary: householdMembers.isPrimary,
    memberName: members.name,
  }).from(householdMembers).leftJoin(members, eq(householdMembers.memberId, members.id));
  return householdRows.map((row) => {
    const householdLinks = links.filter((link) => link.householdId === row.id);
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
      headName: householdLinks.find((link) => link.isPrimary)?.memberName ?? undefined,
    };
  });
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load households", async (requestId) => {
    const access = await requirePermission(request, "families.read");
    if (access.response) return access.response;
    await seedIfEmpty();
    return apiJson({ households: await listHouseholds() }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to create household", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "families.manage");
    if (access.response) return access.response;
    const name = text(payload.name, 160);
    if (!name) throw new ApiError(400, "Household name is required");
    const db = await getDb();
    const headChurchId = text(payload.headChurchId, 30);
    let head: typeof members.$inferSelect | null = null;
    if (headChurchId) {
      [head] = await db.select().from(members).where(eq(members.churchId, headChurchId)).limit(1);
      if (!head) throw new ApiError(400, "Selected household head was not found");
      const [alreadyLinked] = await db.select().from(householdMembers).where(eq(householdMembers.memberId, head.id)).limit(1);
      if (alreadyLinked) throw new ApiError(409, "Selected member already belongs to a household");
    }
    const householdCode = `HH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const [created] = await db.insert(households).values({
      householdCode,
      name,
      address: text(payload.address, 240),
      primaryPhone: text(payload.primaryPhone, 40),
      campus: text(payload.campus, 120) || "Grace Centre",
      pastoralZone: text(payload.pastoralZone, 120) || "Unassigned",
    }).returning();
    if (head) {
      await db.insert(householdMembers).values({ householdId: created.id, memberId: head.id, relationship: "Household head", isPrimary: true });
    }
    await writeAudit(access.user!, "household.created", "household", created.id, requestId, { householdCode, headLinked: Boolean(headChurchId) });
    const [household] = (await listHouseholds()).filter((item) => item.id === created.id);
    return apiJson({ household }, 201, requestId);
  });
}
