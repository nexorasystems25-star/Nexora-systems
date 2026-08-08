import { inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { members } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, assertBodySize, assertSameOriginWrite, safeApi } from "../_security";

const REQUIRED = ["name", "group", "phone"] as const;
const OPTIONAL = ["churchId", "email", "gender", "birthDate", "maritalStatus", "weddingDate", "membershipType", "baptismStatus", "status", "joinedAt"] as const;

function parseCsv(input: string) {
  const rows: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') { value += '"'; index++; } else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[index + 1] === "\n") index++;
      row.push(value); value = ""; if (row.some((cell) => cell.trim())) rows.push(row); row = [];
    } else value += char;
  }
  row.push(value); if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

const validDate = (value: string) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));

export async function POST(request: Request) {
  return safeApi(request, "Unable to import members", async (requestId) => {
    const access = await requirePermission(request, "members.import");
    if (access.response) return access.response;
    assertSameOriginWrite(request); assertBodySize(request, 1024 * 1024);
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) throw new ApiError(415, "Upload a CSV file");
    const form = await request.formData();
    const candidate = form.get("file");
    if (!(candidate instanceof File) || !candidate.size) throw new ApiError(400, "Choose a CSV file");
    if (candidate.size > 1024 * 1024) throw new ApiError(400, "CSV imports must be 1 MB or smaller");
    if (!candidate.name.toLowerCase().endsWith(".csv")) throw new ApiError(400, "Use the ChurchFlow CSV template");
    const rows = parseCsv(await candidate.text());
    if (rows.length < 2) throw new ApiError(400, "The CSV contains no member rows");
    if (rows.length > 501) throw new ApiError(400, "Import a maximum of 500 members at a time");
    const headers = rows[0].map((header) => header.trim());
    for (const required of REQUIRED) if (!headers.includes(required)) throw new ApiError(400, `Missing required column: ${required}`);
    const allowed = new Set<string>([...REQUIRED, ...OPTIONAL]);
    const unsupported = headers.filter((header) => !allowed.has(header));
    if (unsupported.length) throw new ApiError(400, `Unsupported columns: ${unsupported.join(", ")}`);
    const parsed = rows.slice(1).map((cells, rowIndex) => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])) as Record<string,string>).map((item, rowIndex) => {
      if (!item.name) throw new ApiError(400, `Row ${rowIndex + 2}: name is required`);
      if (!item.group) throw new ApiError(400, `Row ${rowIndex + 2}: group is required`);
      if (!item.phone) throw new ApiError(400, `Row ${rowIndex + 2}: phone is required`);
      if (!validDate(item.birthDate) || !validDate(item.weddingDate) || !validDate(item.joinedAt)) throw new ApiError(400, `Row ${rowIndex + 2}: dates must use YYYY-MM-DD`);
      const status = ["Active", "New convert", "Follow-up"].includes(item.status) ? item.status : "Active";
      const churchId = item.churchId || `CH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      return {
        churchId: churchId.slice(0, 30), name: item.name.slice(0, 120),
        initials: item.name.split(/\s+/).map((part) => part[0]).join("").slice(0,2).toUpperCase(),
        groupName: item.group.slice(0,120), phone: item.phone.slice(0,40), email: item.email?.slice(0,254) || null,
        gender: item.gender?.slice(0,40) || null, birthDate: item.birthDate || null, maritalStatus: item.maritalStatus?.slice(0,40) || null,
        weddingDate: item.weddingDate || null, membershipType: item.membershipType?.slice(0,80) || null,
        baptismStatus: item.baptismStatus?.slice(0,80) || null, status, joinedAt: item.joinedAt || new Date().toISOString().slice(0,10),
      };
    });
    const ids = parsed.map((item) => item.churchId);
    if (new Set(ids).size !== ids.length) throw new ApiError(400, "The CSV contains duplicate church IDs");
    const db = await getDb();
    const existing = ids.length ? await db.select({ churchId: members.churchId }).from(members).where(inArray(members.churchId, ids)) : [];
    const duplicates = new Set(existing.map((item) => item.churchId));
    const ready = parsed.filter((item) => !duplicates.has(item.churchId));
    const dryRun = form.get("dryRun") === "true";
    if (!dryRun && ready.length) {
      await db.insert(members).values(ready);
      await writeAudit(access.user!, "members.bulk_imported", "member", "bulk", requestId, { imported: ready.length, skippedDuplicates: duplicates.size, fileName: candidate.name });
    }
    return apiJson({ dryRun, totalRows: parsed.length, ready: ready.length, skippedDuplicates: duplicates.size, errors: 0 }, 200, requestId);
  });
}
