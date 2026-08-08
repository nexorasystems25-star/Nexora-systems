import { asc, count, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { organisationUnits } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

const seeds = [
  { name: "Youth Ministry", type: "Ministry", leaderName: "Priscilla Agyeman", memberCount: 86, meetingSchedule: "Saturdays · 4:00 PM", campus: "Grace Centre" },
  { name: "Women’s Ministry", type: "Fellowship", leaderName: "Deaconess Lydia Owusu", memberCount: 124, meetingSchedule: "Tuesdays · 5:30 PM", campus: "Grace Centre" },
  { name: "Finance Department", type: "Department", leaderName: "Daniel Asante", memberCount: 8, meetingSchedule: "First Monday monthly", campus: "Grace Centre" },
  { name: "Choir", type: "Ministry", leaderName: "Emmanuel Frimpong", memberCount: 34, meetingSchedule: "Thursdays · 6:00 PM", campus: "Grace Centre" },
] as const;

const toUnit = (row: typeof organisationUnits.$inferSelect) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  leaderName: row.leaderName,
  memberCount: row.memberCount,
  meetingSchedule: row.meetingSchedule,
  campus: row.campus,
  status: row.status,
});

async function seedIfEmpty() {
  const db = await getDb();
  const [result] = await db.select({ value: count() }).from(organisationUnits);
  if (result.value === 0) await db.insert(organisationUnits).values(seeds);
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load organisation units", async (requestId) => {
    const access = await requirePermission(request, "ministries.read");
    if (access.response) return access.response;
    await seedIfEmpty();
    const rows = await (await getDb()).select().from(organisationUnits).orderBy(asc(organisationUnits.name));
    return apiJson({ units: rows.map(toUnit) }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to create organisation unit", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "ministries.manage");
    if (access.response) return access.response;
    const name = text(payload.name, 160);
    const type = ["Ministry", "Department", "Fellowship"].includes(String(payload.type)) ? String(payload.type) : "Ministry";
    if (!name) throw new ApiError(400, "Unit name is required");
    const db = await getDb();
    const [duplicate] = await db.select({ id: organisationUnits.id }).from(organisationUnits).where(eq(organisationUnits.name, name)).limit(1);
    if (duplicate) throw new ApiError(409, "A unit with this name already exists");
    const [created] = await db.insert(organisationUnits).values({
      name,
      type,
      leaderName: text(payload.leaderName, 120) || "Unassigned",
      meetingSchedule: text(payload.meetingSchedule, 160) || "To be scheduled",
      campus: text(payload.campus, 120) || "Grace Centre",
    }).returning();
    await writeAudit(access.user!, "organisation_unit.created", "organisation_unit", created.id, requestId, { type, campus: created.campus });
    return apiJson({ unit: toUnit(created) }, 201, requestId);
  });
}
