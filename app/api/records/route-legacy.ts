import { asc, count, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { generatedRecords, members } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

const TYPES = ["Form", "Certificate", "ID Card"] as const;
const TEMPLATES = ["Membership Form", "Child Dedication Form", "Wedding Form", "Funeral Form", "Welfare Form", "Membership Certificate", "Child Dedication Certificate", "Wedding Certificate", "Member ID Card", "Staff ID Card"] as const;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function seedIfEmpty(actorId: number, actorName: string) {
  const db = await getDb();
  const [total] = await db.select({ value: count() }).from(generatedRecords);
  if (total.value) return;
  const people = await db.select().from(members).orderBy(asc(members.id));
  await db.insert(generatedRecords).values([
    { recordCode: "REC-CERT-001", recordType: "Certificate", templateType: "Membership Certificate", memberId: people[0]?.id, subjectName: people[0]?.name || "Akosua Mensah", eventDate: "2026-07-20", fieldsJson: JSON.stringify({ officiant: "Senior Pastor", campus: "Grace Centre" }), status: "Issued", issuedAt: "2026-07-20", issuedByUserId: actorId, issuedByName: actorName, createdByUserId: actorId, createdByName: actorName },
    { recordCode: "REC-ID-002", recordType: "ID Card", templateType: "Member ID Card", memberId: people[1]?.id, subjectName: people[1]?.name || "Kwame Owusu", fieldsJson: JSON.stringify({ campus: "Grace Centre", validUntil: "2027-07-31" }), status: "Draft", createdByUserId: actorId, createdByName: actorName },
    { recordCode: "REC-FORM-003", recordType: "Form", templateType: "Child Dedication Form", memberId: people[2]?.id, subjectName: people[2]?.name || "Abena Boateng", eventDate: "2026-08-16", fieldsJson: JSON.stringify({ officiant: "Senior Pastor" }), status: "Draft", createdByUserId: actorId, createdByName: actorName },
  ]);
}

async function listRecords() {
  const db = await getDb();
  const rows = await db.select({
    id: generatedRecords.id, code: generatedRecords.recordCode, recordType: generatedRecords.recordType,
    templateType: generatedRecords.templateType, memberChurchId: members.churchId, subjectName: generatedRecords.subjectName,
    eventDate: generatedRecords.eventDate, fieldsJson: generatedRecords.fieldsJson, status: generatedRecords.status,
    issuedAt: generatedRecords.issuedAt, issuedByName: generatedRecords.issuedByName,
    createdByName: generatedRecords.createdByName, createdAt: generatedRecords.createdAt,
  }).from(generatedRecords).leftJoin(members, eq(generatedRecords.memberId, members.id)).orderBy(asc(generatedRecords.status), asc(generatedRecords.createdAt));
  return rows.map((row) => {
    let fields: Record<string, string> = {};
    try { fields = JSON.parse(row.fieldsJson) as Record<string, string>; } catch {}
    return { ...row, fields, fieldsJson: undefined };
  });
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load church records", async (requestId) => {
    const access = await requirePermission(request, "records.read");
    if (access.response) return access.response;
    await seedIfEmpty(access.user!.id, access.user!.name);
    return apiJson({ records: await listRecords(), templates: TEMPLATES }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to create church record", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "records.manage");
    if (access.response) return access.response;
    const recordType = clean(payload.recordType, 30);
    const templateType = clean(payload.templateType, 80);
    const memberChurchId = clean(payload.memberChurchId, 30);
    const subjectName = clean(payload.subjectName, 120);
    if (!TYPES.includes(recordType as typeof TYPES[number]) || !TEMPLATES.includes(templateType as typeof TEMPLATES[number])) throw new ApiError(400, "Choose a valid record and template type");
    const db = await getDb();
    const [member] = memberChurchId ? await db.select().from(members).where(eq(members.churchId, memberChurchId)).limit(1) : [];
    if (memberChurchId && !member) throw new ApiError(404, "Selected member was not found");
    if (!member && !subjectName) throw new ApiError(400, "Select a member or enter the subject name");
    const fields = { officiant: clean(payload.officiant, 120), campus: clean(payload.campus, 100) || "Grace Centre", validUntil: clean(payload.validUntil, 10), notes: clean(payload.notes, 500) };
    const recordCode = `REC-${recordType === "ID Card" ? "ID" : recordType === "Certificate" ? "CERT" : "FORM"}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const [created] = await db.insert(generatedRecords).values({
      recordCode, recordType, templateType, memberId: member?.id, subjectName: member?.name || subjectName,
      eventDate: clean(payload.eventDate, 10) || null, fieldsJson: JSON.stringify(fields),
      createdByUserId: access.user!.id, createdByName: access.user!.name,
    }).returning({ id: generatedRecords.id });
    await writeAudit(access.user!, "record.created", "generated_record", created.id, requestId, { recordCode, recordType, templateType });
    return apiJson({ records: await listRecords() }, 201, requestId);
  });
}

export async function PATCH(request: Request) {
  return safeApi(request, "Unable to issue church record", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "records.issue");
    if (access.response) return access.response;
    const id = Number(payload.id);
    if (!Number.isInteger(id)) throw new ApiError(400, "Choose a valid record");
    const db = await getDb();
    const [record] = await db.select().from(generatedRecords).where(eq(generatedRecords.id, id)).limit(1);
    if (!record) throw new ApiError(404, "Record was not found");
    if (record.status === "Issued") throw new ApiError(409, "This record has already been issued");
    await db.update(generatedRecords).set({ status: "Issued", issuedAt: new Date().toISOString(), issuedByUserId: access.user!.id, issuedByName: access.user!.name, updatedAt: new Date().toISOString() }).where(eq(generatedRecords.id, id));
    await writeAudit(access.user!, "record.issued", "generated_record", id, requestId, { recordCode: record.recordCode, templateType: record.templateType });
    return apiJson({ records: await listRecords() }, 200, requestId);
  });
}
