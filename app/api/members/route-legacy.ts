import { asc, count, eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import { members } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, assertBodySize, assertSameOriginWrite, readJson, safeApi } from "../_security";
import { resolveTenantContext, checkTenantPermission, type TenantContext } from "../_tenant-compat";

const seeds = [
  ["CH-0241", "Akosua Mensah", "AM", "Women’s Ministry", "024 000 1842", "Active", "14 Feb 2022"],
  ["CH-0318", "Kwame Owusu", "KO", "Men’s Ministry", "055 410 8821", "Active", "08 Jul 2023"],
  ["CH-0397", "Abena Boateng", "AB", "Youth Ministry", "020 771 1904", "New convert", "21 Jul 2026"],
  ["CH-0374", "Kofi Asare", "KA", "Choir", "027 120 3301", "Follow-up", "11 Jun 2026"],
  ["CH-0355", "Esi Addo", "EA", "Children’s Ministry", "054 662 1172", "Active", "03 Jan 2025"],
] as const;

const text = (value: FormDataEntryValue | null, max = 3000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const limited = (value: unknown, label: string, max: number, required = false) => {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new ApiError(400, `${label} is required`);
  if (result.length > max) throw new ApiError(400, `${label} is too long`);
  return result;
};

async function seedIfEmpty() {
  const db = await getDb();
  const [result] = await db.select({ value: count() }).from(members);
  if (result.value === 0) {
    await db.insert(members).values(
      seeds.map(([churchId, name, initials, groupName, phone, status, joinedAt]) => ({
        churchId, name, initials, groupName, phone, status, joinedAt,
      })),
    );
  }
}

function toMember(row: typeof members.$inferSelect) {
  return {
    name: row.name,
    initials: row.initials,
    id: row.churchId,
    group: row.groupName,
    phone: row.phone,
    email: row.email ?? "",
    gender: row.gender ?? "",
    birthDate: row.birthDate ?? "",
    maritalStatus: row.maritalStatus ?? "",
    weddingDate: row.weddingDate ?? "",
    address: row.address ?? "",
    hometown: row.hometown ?? "",
    occupation: row.occupation ?? "",
    membershipType: row.membershipType ?? "",
    baptismStatus: row.baptismStatus ?? "",
    emergencyName: row.emergencyName ?? "",
    emergencyPhone: row.emergencyPhone ?? "",
    notes: row.notes ?? "",
    profilePhotoUrl: row.profilePhotoKey ? `/api/member-photo?id=${encodeURIComponent(row.churchId)}` : undefined,
    status: row.status,
    joined: row.joinedAt,
  };
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load members", async (requestId) => {
    // Try tenant context first, fall back to legacy auth
    const tenantContext = await resolveTenantContext(request);
    
    if (tenantContext) {
      // Tenant-scoped access
      const hasPermission = await checkTenantPermission(tenantContext, "members.read");
      if (!hasPermission) {
        return apiJson({ error: "Insufficient permissions" }, 403, requestId);
      }
      
      await seedIfEmpty();
      const db = await getDb();
      // TODO: Add tenant_id to members table and scope query
      // const rows = await db.select().from(members)
      //   .where(eq(members.tenantId, tenantContext.tenantId))
      //   .orderBy(asc(members.name));
      const rows = await db.select().from(members).orderBy(asc(members.name));
      return apiJson({ members: rows.map(toMember), tenant: tenantContext.tenant }, 200, requestId);
    }
    
    // Legacy auth fallback
    const access = await requirePermission(request, "members.read");
    if (access.response) return access.response;
    await seedIfEmpty();
    const rows = await (await getDb()).select().from(members).orderBy(asc(members.name));
    return apiJson({ members: rows.map(toMember) }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to add member", async (requestId) => {
    // Try tenant context first, fall back to legacy auth
    const tenantContext = await resolveTenantContext(request);
    
    if (tenantContext) {
      // Tenant-scoped access
      const hasPermission = await checkTenantPermission(tenantContext, "members.write");
      if (!hasPermission) {
        return apiJson({ error: "Insufficient permissions" }, 403, requestId);
      }
    } else {
      // Legacy auth fallback
      const access = await requirePermission(request, "members.create");
      if (access.response) return access.response;
    }
    
    assertSameOriginWrite(request);
    assertBodySize(request, 6 * 1024 * 1024);
    const contentType = request.headers.get("content-type") ?? "";
    let payload: Record<string, string> = {};
    let photo: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const key of ["name", "phone", "email", "gender", "birthDate", "maritalStatus", "weddingDate", "address", "hometown", "occupation", "membershipType", "baptismStatus", "group", "emergencyName", "emergencyPhone", "notes"]) {
        payload[key] = text(form.get(key));
      }
      const candidate = form.get("profilePhoto");
      photo = candidate instanceof File && candidate.size > 0 ? candidate : null;
    } else {
      payload = await readJson<Record<string, string>>(request);
    }

    const name = limited(payload.name, "Name", 120, true);
    if (photo && photo.size > 5 * 1024 * 1024) throw new ApiError(400, "Profile photo must be 5 MB or smaller");
    if (photo && !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) throw new ApiError(400, "Use a JPG, PNG or WebP profile photo");

    const db = await getDb();
    const churchId = `CH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    let profilePhotoKey: string | null = null;

    if (photo) {
      const moduleName = ["cloudflare", "workers"].join(":");
      const { env } = (await import(/* @vite-ignore */ moduleName)) as typeof import("cloudflare:workers");
      const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
      profilePhotoKey = `members/${churchId}/${crypto.randomUUID()}.${extension}`;
      await env.BUCKET.put(profilePhotoKey, await photo.arrayBuffer(), { httpMetadata: { contentType: photo.type } });
    }

    const values = {
      churchId,
      name,
      initials,
      groupName: limited(payload.group, "Group", 120) || "General",
      phone: limited(payload.phone, "Phone", 40),
      email: limited(payload.email, "Email", 254) || null,
      gender: limited(payload.gender, "Gender", 40) || null,
      birthDate: limited(payload.birthDate, "Birth date", 10) || null,
      maritalStatus: limited(payload.maritalStatus, "Marital status", 40) || null,
      weddingDate: limited(payload.weddingDate, "Wedding date", 10) || null,
      address: limited(payload.address, "Address", 240) || null,
      hometown: limited(payload.hometown, "Hometown", 120) || null,
      occupation: limited(payload.occupation, "Occupation", 120) || null,
      membershipType: limited(payload.membershipType, "Membership type", 80) || null,
      baptismStatus: limited(payload.baptismStatus, "Baptism status", 80) || null,
      emergencyName: limited(payload.emergencyName, "Emergency contact", 120) || null,
      emergencyPhone: limited(payload.emergencyPhone, "Emergency phone", 40) || null,
      notes: limited(payload.notes, "Pastoral notes", 3000) || null,
      profilePhotoKey,
      status: "Active",
      joinedAt: new Date().toISOString().slice(0, 10),
      // Add tenant_id if available (will be added after schema update)
      // tenantId: tenantContext?.tenantId || null,
    };
    const [created] = await db.insert(members).values(values).returning();
    
    // Audit with tenant context if available
    const auditUser = tenantContext?.user || access.user;
    await writeAudit(auditUser as any, "member.created", "member", created.id, requestId, { 
      churchId, 
      group: values.groupName, 
      photoUploaded: Boolean(photo),
      tenantId: tenantContext?.tenantId 
    });
    return apiJson({ member: toMember(created) }, 201, requestId);
  });
}

export async function PATCH(request: Request) {
  return safeApi(request, "Unable to update member", async (requestId) => {
    // Try tenant context first, fall back to legacy auth
    const tenantContext = await resolveTenantContext(request);
    
    if (tenantContext) {
      // Tenant-scoped access
      const hasPermission = await checkTenantPermission(tenantContext, "members.write");
      if (!hasPermission) {
        return apiJson({ error: "Insufficient permissions" }, 403, requestId);
      }
    } else {
      // Legacy auth fallback
      const access = await requirePermission(request, "members.update");
      if (access.response) return access.response;
    }
    
    assertSameOriginWrite(request);
    assertBodySize(request, 6 * 1024 * 1024);
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) throw new ApiError(415, "This endpoint requires a form upload");
    const form = await request.formData();
    const churchId = text(form.get("id"), 30);
    const name = text(form.get("name"), 120);
    if (!churchId || !name) throw new ApiError(400, "Member ID and name are required");

    const db = await getDb();
    const [existing] = await db.select().from(members).where(eq(members.churchId, churchId)).limit(1);
    if (!existing) throw new ApiError(404, "Member record not found");

    const candidate = form.get("profilePhoto");
    const photo = candidate instanceof File && candidate.size > 0 ? candidate : null;
    if (photo && photo.size > 5 * 1024 * 1024) throw new ApiError(400, "Profile photo must be 5 MB or smaller");
    if (photo && !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) throw new ApiError(400, "Use a JPG, PNG or WebP profile photo");

    let profilePhotoKey = existing.profilePhotoKey;
    let previousPhotoKey: string | null = null;
    if (photo) {
      const moduleName = ["cloudflare", "workers"].join(":");
      const { env } = (await import(/* @vite-ignore */ moduleName)) as typeof import("cloudflare:workers");
      const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
      profilePhotoKey = `members/${churchId}/${crypto.randomUUID()}.${extension}`;
      await env.BUCKET.put(profilePhotoKey, await photo.arrayBuffer(), { httpMetadata: { contentType: photo.type } });
      previousPhotoKey = existing.profilePhotoKey;
    }

    const values = {
      name,
      initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      groupName: text(form.get("group"), 120) || "General",
      phone: text(form.get("phone"), 40),
      email: text(form.get("email"), 254) || null,
      gender: text(form.get("gender"), 40) || null,
      birthDate: text(form.get("birthDate"), 10) || null,
      maritalStatus: text(form.get("maritalStatus"), 40) || null,
      weddingDate: text(form.get("weddingDate"), 10) || null,
      address: text(form.get("address"), 240) || null,
      hometown: text(form.get("hometown"), 120) || null,
      occupation: text(form.get("occupation"), 120) || null,
      membershipType: text(form.get("membershipType"), 80) || null,
      baptismStatus: text(form.get("baptismStatus"), 80) || null,
      emergencyName: text(form.get("emergencyName"), 120) || null,
      emergencyPhone: text(form.get("emergencyPhone"), 40) || null,
      notes: text(form.get("notes"), 3000) || null,
      status: ["Active", "New convert", "Follow-up"].includes(text(form.get("status"), 30)) ? text(form.get("status"), 30) : existing.status,
      profilePhotoKey,
    };
    await db.update(members).set(values).where(eq(members.churchId, churchId));
    
    // Audit with tenant context if available
    const auditUser = tenantContext?.user || access.user;
    await writeAudit(auditUser as any, "member.updated", "member", existing.id, requestId, { 
      churchId, 
      photoUpdated: Boolean(photo), 
      status: values.status,
      tenantId: tenantContext?.tenantId 
    });

    if (previousPhotoKey) {
      const moduleName = ["cloudflare", "workers"].join(":");
      const { env } = (await import(/* @vite-ignore */ moduleName)) as typeof import("cloudflare:workers");
      await env.BUCKET.delete(previousPhotoKey);
    }
    return apiJson({ member: { ...toMember({ ...existing, ...values }), profilePhotoUrl: profilePhotoKey ? `/api/member-photo?id=${encodeURIComponent(churchId)}&v=${Date.now()}` : undefined } }, 200, requestId);
  });
}
