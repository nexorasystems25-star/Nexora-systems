import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { members, users } from "../../../db/schema";
import { defaultRole, type RoleKey, rolePolicies } from "../../../lib/access";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

const safeUser = (row: typeof users.$inferSelect, memberChurchId?: string | null) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  roleLabel: rolePolicies[row.role as RoleKey]?.label ?? row.role,
  campus: row.campus,
  status: row.status,
  memberId: row.memberId,
  memberChurchId: memberChurchId ?? null,
  createdAt: row.createdAt,
  lastActiveAt: row.lastActiveAt,
});

function clean(value: unknown, label: string, max: number, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new ApiError(400, `${label} is required`);
  if (result.length > max) throw new ApiError(400, `${label} is too long`);
  return result;
}

function validEmail(value: unknown) {
  const email = clean(value, "Email", 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "Enter a valid email address");
  return email;
}

function validId(value: unknown) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "User ID is invalid");
  return id;
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load users", async (requestId) => {
    const access = await requirePermission(request, "administration.manage");
    if (access.response) return access.response;
    const db = await getDb();
    const rows = await db.select().from(users).orderBy(asc(users.name));
    const memberRows = await db.select({ id: members.id, churchId: members.churchId }).from(members);
    const churchIds = new Map(memberRows.map((member) => [member.id, member.churchId]));
    return apiJson({ users: rows.map((row) => safeUser(row, row.memberId ? churchIds.get(row.memberId) : null)), roles: rolePolicies }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to add user", async (requestId) => {
    const payload = await readJson<{ name?: unknown; email?: unknown; role?: unknown; campus?: unknown; memberChurchId?: unknown }>(request);
    const access = await requirePermission(request, "administration.manage");
    if (access.response) return access.response;
    const name = clean(payload.name, "Name", 120, true);
    const email = validEmail(payload.email);
    const campus = clean(payload.campus, "Campus", 120) || "Grace Centre";
    const role = typeof payload.role === "string" && payload.role in rolePolicies ? payload.role as RoleKey : defaultRole;
    const db = await getDb();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new ApiError(409, "A user with this email already exists");
    let linkedMember: typeof members.$inferSelect | null = null;
    if (role === "member") {
      const memberChurchId = clean(payload.memberChurchId, "Member church ID", 30, true);
      [linkedMember] = await db.select().from(members).where(eq(members.churchId, memberChurchId)).limit(1);
      if (!linkedMember || linkedMember.status !== "Active") throw new ApiError(404, "Active member record was not found");
      const [linkedUser] = await db.select({ id: users.id }).from(users).where(eq(users.memberId, linkedMember.id)).limit(1);
      if (linkedUser) throw new ApiError(409, "This member already has portal access");
      if (linkedMember.email && linkedMember.email.toLowerCase() !== email) throw new ApiError(409, "The login email must match the member profile email");
    }
    const [created] = await db.insert(users).values({ name, email, role, campus, status: "Active", memberId: linkedMember?.id ?? null }).returning();
    await writeAudit(access.user!, "administration.user.created", "user", created.id, requestId, { role, campus, memberChurchId: linkedMember?.churchId ?? null });
    return apiJson({ user: safeUser(created, linkedMember?.churchId) }, 201, requestId);
  });
}

export async function PATCH(request: Request) {
  return safeApi(request, "Unable to update user", async (requestId) => {
    const payload = await readJson<{ id?: unknown; role?: unknown; status?: unknown }>(request);
    const access = await requirePermission(request, "administration.manage");
    if (access.response) return access.response;
    const id = validId(payload.id);
    const db = await getDb();
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) throw new ApiError(404, "User account was not found");
    const changes: { role?: string; status?: string; memberId?: number | null } = {};
    if (typeof payload.role === "string") {
      if (!(payload.role in rolePolicies)) throw new ApiError(400, "Role is invalid");
      if (payload.role === "member" && !target.memberId) throw new ApiError(409, "Create member portal access by linking a member record");
      changes.role = payload.role;
      if (payload.role !== "member") changes.memberId = null;
    }
    if (typeof payload.status === "string") {
      if (!["Active", "Inactive"].includes(payload.status)) throw new ApiError(400, "Status is invalid");
      changes.status = payload.status;
    }
    if (!Object.keys(changes).length) throw new ApiError(400, "No valid changes supplied");
    if (id === access.user!.id && (changes.status === "Inactive" || (changes.role && changes.role !== "super_admin"))) {
      throw new ApiError(409, "You cannot remove your own administrator access");
    }
    const removesSuperAdmin = target.role === "super_admin" &&
      (changes.status === "Inactive" || (changes.role && changes.role !== "super_admin"));
    if (removesSuperAdmin) {
      const activeAdmins = (await db.select({ id: users.id, status: users.status }).from(users).where(eq(users.role, "super_admin")))
        .filter((user) => user.status === "Active");
      if (activeAdmins.length <= 1) throw new ApiError(409, "At least one active super administrator is required");
    }
    await db.update(users).set(changes).where(eq(users.id, id));
    const [updated] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    await writeAudit(access.user!, "administration.user.updated", "user", id, requestId, {
      previousRole: target.role,
      role: updated.role,
      previousStatus: target.status,
      status: updated.status,
    });
    return apiJson({ user: safeUser(updated) }, 200, requestId);
  });
}
