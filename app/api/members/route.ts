import { asc, count, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { cfMembers } from "../../../db/schema-platform";
import { withTenantContext, writeTenantAudit } from "../_tenant";
import { ApiError, apiJson, assertBodySize, assertSameOriginWrite, readJson, safeApi } from "../_security";
import type { PlatformUser } from "../../lib/auth-platform";

// ============================================================================
// MEMBERS API - Tenant-Scoped
// ============================================================================
// All queries are now filtered by tenant_id
// ============================================================================

const text = (value: FormDataEntryValue | null, max = 3000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const limited = (
  value: unknown,
  label: string,
  max: number,
  required = false
) => {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new ApiError(400, `${label} is required`);
  if (result.length > max) throw new ApiError(400, `${label} is too long`);
  return result;
};

function toMember(row: typeof cfMembers.$inferSelect) {
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
    profilePhotoUrl: row.profilePhotoKey
      ? `/api/member-photo?id=${encodeURIComponent(row.churchId)}`
      : undefined,
    status: row.status,
    joined: row.joinedAt,
  };
}

export async function GET(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const db = await getDb();

      // Tenant-scoped query
      const rows = await db
        .select()
        .from(cfMembers)
        .where(eq(cfMembers.tenantId, tenantId))
        .orderBy(asc(cfMembers.name));

      return apiJson({ members: rows.map(toMember) }, 200, requestId);
    },
    { permission: "members:read" }
  );
}

export async function POST(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      assertSameOriginWrite(request);
      assertBodySize(request, 6 * 1024 * 1024);

      const contentType = request.headers.get("content-type") ?? "";
      let payload: Record<string, string> = {};
      let photo: File | null = null;

      if (contentType.includes("multipart/form-data")) {
        const form = await request.formData();
        for (const key of [
          "name",
          "phone",
          "email",
          "gender",
          "birthDate",
          "maritalStatus",
          "weddingDate",
          "address",
          "hometown",
          "occupation",
          "membershipType",
          "baptismStatus",
          "group",
          "emergencyName",
          "emergencyPhone",
          "notes",
        ]) {
          payload[key] = text(form.get(key));
        }
        const candidate = form.get("profilePhoto");
        photo =
          candidate instanceof File && candidate.size > 0 ? candidate : null;
      } else {
        payload = await readJson<Record<string, string>>(request);
      }

      const name = limited(payload.name, "Name", 120, true);
      if (photo && photo.size > 5 * 1024 * 1024)
        throw new ApiError(400, "Profile photo must be 5 MB or smaller");
      if (
        photo &&
        !["image/jpeg", "image/png", "image/webp"].includes(photo.type)
      )
        throw new ApiError(400, "Use a JPG, PNG or WebP profile photo");

      const db = await getDb();
      const churchId = `CH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const initials = name
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      let profilePhotoKey: string | null = null;
      if (photo) {
        const ext = photo.name.split(".").pop() || "jpg";
        profilePhotoKey = `members/${tenantId}/${churchId}.${ext}`;
        // TODO: Upload to R2 with tenant-scoped key
      }

      // Insert with tenant_id
      const [row] = await db
        .insert(cfMembers)
        .values({
          tenantId,
          churchId,
          name,
          initials,
          groupName: limited(payload.group, "Group", 100) || "General",
          phone: limited(payload.phone, "Phone", 30) || "",
          email: limited(payload.email, "Email", 200) || null,
          gender: limited(payload.gender, "Gender", 20) || null,
          birthDate: limited(payload.birthDate, "Birth date", 10) || null,
          maritalStatus:
            limited(payload.maritalStatus, "Marital status", 30) || null,
          weddingDate:
            limited(payload.weddingDate, "Wedding date", 10) || null,
          address: limited(payload.address, "Address", 400) || null,
          hometown: limited(payload.hometown, "Hometown", 120) || null,
          occupation: limited(payload.occupation, "Occupation", 120) || null,
          membershipType:
            limited(payload.membershipType, "Membership type", 40) || null,
          baptismStatus:
            limited(payload.baptismStatus, "Baptism status", 40) || null,
          emergencyName:
            limited(payload.emergencyName, "Emergency contact name", 120) ||
            null,
          emergencyPhone:
            limited(
              payload.emergencyPhone,
              "Emergency contact phone",
              30
            ) || null,
          notes: limited(payload.notes, "Notes", 2000) || null,
          profilePhotoKey,
          status: "Active",
        })
        .returning();

      // Audit log
      await writeTenantAudit(
        tenantId,
        user,
        "member.create",
        "member",
        row.churchId,
        `Created member: ${name}`
      );

      return apiJson({ member: toMember(row) }, 201, requestId);
    },
    { permission: "members:write" }
  );
}

export async function PATCH(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      assertSameOriginWrite(request);
      const payload = await readJson<Record<string, unknown>>(request);
      const id = String(payload.id || "").trim();
      if (!id) throw new ApiError(400, "Member ID is required");

      const db = await getDb();

      // Verify member belongs to this tenant
      const [existing] = await db
        .select()
        .from(cfMembers)
        .where(
          eq(cfMembers.churchId, id) && eq(cfMembers.tenantId, tenantId)
        )
        .limit(1);

      if (!existing) throw new ApiError(404, "Member not found");

      const updates: Record<string, unknown> = {};
      if (typeof payload.name === "string") updates.name = payload.name;
      if (typeof payload.phone === "string") updates.phone = payload.phone;
      if (typeof payload.email === "string") updates.email = payload.email;
      if (typeof payload.gender === "string") updates.gender = payload.gender;
      if (typeof payload.birthDate === "string")
        updates.birthDate = payload.birthDate;
      if (typeof payload.maritalStatus === "string")
        updates.maritalStatus = payload.maritalStatus;
      if (typeof payload.weddingDate === "string")
        updates.weddingDate = payload.weddingDate;
      if (typeof payload.address === "string")
        updates.address = payload.address;
      if (typeof payload.hometown === "string")
        updates.hometown = payload.hometown;
      if (typeof payload.occupation === "string")
        updates.occupation = payload.occupation;
      if (typeof payload.membershipType === "string")
        updates.membershipType = payload.membershipType;
      if (typeof payload.baptismStatus === "string")
        updates.baptismStatus = payload.baptismStatus;
      if (typeof payload.emergencyName === "string")
        updates.emergencyName = payload.emergencyName;
      if (typeof payload.emergencyPhone === "string")
        updates.emergencyPhone = payload.emergencyPhone;
      if (typeof payload.notes === "string") updates.notes = payload.notes;
      if (typeof payload.status === "string") updates.status = payload.status;
      if (typeof payload.group === "string") updates.groupName = payload.group;

      if (Object.keys(updates).length === 0) {
        throw new ApiError(400, "No valid fields to update");
      }

      updates.updatedAt = new Date().toISOString();

      const [updated] = await db
        .update(cfMembers)
        .set(updates)
        .where(
          eq(cfMembers.churchId, id) && eq(cfMembers.tenantId, tenantId)
        )
        .returning();

      await writeTenantAudit(
        tenantId,
        user,
        "member.update",
        "member",
        id,
        `Updated member: ${updated.name}`
      );

      return apiJson({ member: toMember(updated) }, 200, requestId);
    },
    { permission: "members:write" }
  );
}

export async function DELETE(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      assertSameOriginWrite(request);
      const url = new URL(request.url);
      const id = url.searchParams.get("id");
      if (!id) throw new ApiError(400, "Member ID is required");

      const db = await getDb();

      // Verify member belongs to this tenant
      const [existing] = await db
        .select()
        .from(cfMembers)
        .where(
          eq(cfMembers.churchId, id) && eq(cfMembers.tenantId, tenantId)
        )
        .limit(1);

      if (!existing) throw new ApiError(404, "Member not found");

      // Soft delete (set status to Archived)
      await db
        .update(cfMembers)
        .set({ status: "Archived" })
        .where(
          eq(cfMembers.churchId, id) && eq(cfMembers.tenantId, tenantId)
        );

      await writeTenantAudit(
        tenantId,
        user,
        "member.delete",
        "member",
        id,
        `Archived member: ${existing.name}`
      );

      return apiJson({ success: true }, 200, requestId);
    },
    { permission: "members:delete" }
  );
}
