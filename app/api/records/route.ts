import { asc, count, eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import { cfGeneratedRecords, cfMembers } from "../../../db/schema-platform";
import { withTenantContext, writeTenantAudit } from "../_tenant";
import { ApiError, apiJson, readJson } from "../_security";
import type { PlatformUser } from "../../lib/auth-platform";

const TYPES = ["Form", "Certificate", "ID Card"] as const;
const TEMPLATES = [
  "Membership Form",
  "Child Dedication Form",
  "Wedding Form",
  "Funeral Form",
  "Welfare Form",
  "Membership Certificate",
  "Child Dedication Certificate",
  "Wedding Certificate",
  "Member ID Card",
  "Staff ID Card",
] as const;
const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

async function listRecords(tenantId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: cfGeneratedRecords.id,
      code: cfGeneratedRecords.recordCode,
      recordType: cfGeneratedRecords.recordType,
      templateType: cfGeneratedRecords.templateType,
      memberChurchId: cfMembers.churchId,
      subjectName: cfGeneratedRecords.subjectName,
      eventDate: cfGeneratedRecords.eventDate,
      fieldsJson: cfGeneratedRecords.fieldsJson,
      status: cfGeneratedRecords.status,
      issuedAt: cfGeneratedRecords.issuedAt,
      issuedByName: cfGeneratedRecords.issuedByName,
      createdByName: cfGeneratedRecords.createdByName,
      createdAt: cfGeneratedRecords.createdAt,
    })
    .from(cfGeneratedRecords)
    .where(eq(cfGeneratedRecords.tenantId, tenantId))
    .leftJoin(cfMembers, eq(cfGeneratedRecords.memberId, cfMembers.id))
    .orderBy(
      asc(cfGeneratedRecords.status),
      asc(cfGeneratedRecords.createdAt)
    );

  return rows.map((row) => {
    let fields: Record<string, string> = {};
    try {
      fields = JSON.parse(row.fieldsJson) as Record<string, string>;
    } catch {}
    return { ...row, fields, fieldsJson: undefined };
  });
}

export async function GET(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const records = await listRecords(tenantId);
      return apiJson(
        { records, templates: TEMPLATES },
        200,
        requestId
      );
    },
    { permission: "records:read" }
  );
}

export async function POST(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<Record<string, unknown>>(request);
      const recordType = clean(payload.recordType, 30);
      const templateType = clean(payload.templateType, 80);
      const memberChurchId = clean(payload.memberChurchId, 30);
      const subjectName = clean(payload.subjectName, 120);

      if (
        !TYPES.includes(recordType as (typeof TYPES)[number]) ||
        !TEMPLATES.includes(templateType as (typeof TEMPLATES)[number])
      )
        throw new ApiError(
          400,
          "Choose a valid record and template type"
        );

      const db = await getDb();
      let memberId: number | null = null;
      let resolvedName = subjectName;

      if (memberChurchId) {
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
          throw new ApiError(
            404,
            "Selected member was not found"
          );
        memberId = member.id;
        resolvedName = member.name;
      }

      if (!memberId && !subjectName)
        throw new ApiError(
          400,
          "Select a member or enter the subject name"
        );

      const fields = {
        officiant: clean(payload.officiant, 120),
        campus:
          clean(payload.campus, 100) || "Grace Centre",
        validUntil: clean(payload.validUntil, 10),
        notes: clean(payload.notes, 500),
      };

      const recordCode = `REC-${recordType === "ID Card" ? "ID" : recordType === "Certificate" ? "CERT" : "FORM"}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

      const [created] = await db
        .insert(cfGeneratedRecords)
        .values({
          tenantId,
          recordCode,
          recordType,
          templateType,
          memberId,
          subjectName: resolvedName,
          eventDate: clean(payload.eventDate, 10) || null,
          fieldsJson: JSON.stringify(fields),
          createdByUserId: user.identityId,
          createdByName: user.fullName,
        })
        .returning({ id: cfGeneratedRecords.id });

      await writeTenantAudit(
        tenantId,
        user,
        "record.create",
        "generated_record",
        String(created.id),
        `Created record: ${recordCode}`
      );

      const records = await listRecords(tenantId);
      return apiJson({ records }, 201, requestId);
    },
    { permission: "records:write" }
  );
}

export async function PATCH(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<Record<string, unknown>>(request);
      const id = Number(payload.id);
      if (!Number.isInteger(id))
        throw new ApiError(400, "Choose a valid record");

      const db = await getDb();
      const [record] = await db
        .select()
        .from(cfGeneratedRecords)
        .where(
          and(
            eq(cfGeneratedRecords.id, id),
            eq(cfGeneratedRecords.tenantId, tenantId)
          )
        )
        .limit(1);
      if (!record)
        throw new ApiError(404, "Record was not found");
      if (record.status === "Issued")
        throw new ApiError(
          409,
          "This record has already been issued"
        );

      await db
        .update(cfGeneratedRecords)
        .set({
          status: "Issued",
          issuedAt: new Date().toISOString(),
          issuedByUserId: user.identityId,
          issuedByName: user.fullName,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(cfGeneratedRecords.id, id),
            eq(cfGeneratedRecords.tenantId, tenantId)
          )
        );

      await writeTenantAudit(
        tenantId,
        user,
        "record.issue",
        "generated_record",
        String(id),
        `Issued record: ${record.recordCode}`
      );

      const records = await listRecords(tenantId);
      return apiJson({ records }, 200, requestId);
    },
    { permission: "records:write" }
  );
}
