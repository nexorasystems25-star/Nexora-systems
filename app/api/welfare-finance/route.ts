import { asc, count, eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import { financeFunds, financeTransactions, members, welfareRequests } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const money = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) throw new ApiError(400, "Enter a valid positive amount");
  return Math.round(amount * 100);
};

async function seedIfEmpty(actorId: number, actorName: string) {
  const db = await getDb();
  const [total] = await db.select({ value: count() }).from(welfareRequests);
  if (total.value) return;
  const people = await db.select().from(members).orderBy(asc(members.id));
  await db.insert(welfareRequests).values([
    { requestCode: "WFR-2607-001", memberId: people[0]?.id, beneficiaryName: people[0]?.name || "Akosua Mensah", beneficiaryPhone: people[0]?.phone, supportType: "Medical assistance", amountRequestedPesewas: 180000, urgency: "High", assessmentSummary: "Short-term medical support request awaiting committee review.", status: "Pending assessment", requestedByUserId: actorId, requestedByName: actorName },
    { requestCode: "WFR-2607-002", memberId: people[1]?.id, beneficiaryName: people[1]?.name || "Kwame Owusu", beneficiaryPhone: people[1]?.phone, supportType: "Emergency household support", amountRequestedPesewas: 95000, amountApprovedPesewas: 80000, urgency: "Urgent", assessmentSummary: "Committee-approved emergency household support.", status: "Disbursement pending", requestedByUserId: actorId, requestedByName: actorName, reviewedByName: "Welfare Chair", reviewedAt: "2026-07-29" },
  ]);
}

async function listRequests() {
  const db = await getDb();
  const rows = await db.select({
    id: welfareRequests.id, code: welfareRequests.requestCode, memberChurchId: members.churchId,
    beneficiaryName: welfareRequests.beneficiaryName, beneficiaryPhone: welfareRequests.beneficiaryPhone,
    supportType: welfareRequests.supportType, amountRequestedPesewas: welfareRequests.amountRequestedPesewas,
    amountApprovedPesewas: welfareRequests.amountApprovedPesewas, urgency: welfareRequests.urgency,
    assessmentSummary: welfareRequests.assessmentSummary, assignedCommittee: welfareRequests.assignedCommittee,
    decisionReason: welfareRequests.decisionReason, status: welfareRequests.status,
    financeTransactionId: welfareRequests.financeTransactionId, requestedByUserId: welfareRequests.requestedByUserId,
    requestedByName: welfareRequests.requestedByName, reviewedByName: welfareRequests.reviewedByName,
    reviewedAt: welfareRequests.reviewedAt, createdAt: welfareRequests.createdAt,
  }).from(welfareRequests).leftJoin(members, eq(welfareRequests.memberId, members.id)).orderBy(asc(welfareRequests.status), asc(welfareRequests.createdAt));
  return rows.map((row) => ({ ...row, amountRequested: row.amountRequestedPesewas / 100, amountApproved: row.amountApprovedPesewas == null ? null : row.amountApprovedPesewas / 100 }));
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load welfare finance", async (requestId) => {
    const access = await requirePermission(request, "welfare.read");
    if (access.response) return access.response;
    await seedIfEmpty(access.user!.id, access.user!.name);
    return apiJson({ requests: await listRequests() }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to create welfare request", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "welfare.manage");
    if (access.response) return access.response;
    const memberChurchId = clean(payload.memberChurchId, 30);
    const beneficiaryName = clean(payload.beneficiaryName, 120);
    const supportType = clean(payload.supportType, 80);
    const assessmentSummary = clean(payload.assessmentSummary, 600);
    if (!supportType || !assessmentSummary || (!memberChurchId && !beneficiaryName)) throw new ApiError(400, "Beneficiary, support type and assessment summary are required");
    const db = await getDb();
    const [member] = memberChurchId ? await db.select().from(members).where(eq(members.churchId, memberChurchId)).limit(1) : [];
    if (memberChurchId && !member) throw new ApiError(404, "Selected member was not found");
    const requestCode = `WFR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const [created] = await db.insert(welfareRequests).values({
      requestCode, memberId: member?.id, beneficiaryName: member?.name || beneficiaryName,
      beneficiaryPhone: member?.phone || clean(payload.beneficiaryPhone, 30), supportType,
      amountRequestedPesewas: money(payload.amountRequested), urgency: clean(payload.urgency, 20) || "Normal",
      assessmentSummary, assignedCommittee: clean(payload.assignedCommittee, 100) || "Welfare Committee",
      requestedByUserId: access.user!.id, requestedByName: access.user!.name,
    }).returning({ id: welfareRequests.id });
    await writeAudit(access.user!, "welfare.request.created", "welfare_request", created.id, requestId, { requestCode, supportType });
    return apiJson({ request: (await listRequests()).find((item) => item.id === created.id), requests: await listRequests() }, 201, requestId);
  });
}

export async function PATCH(request: Request) {
  return safeApi(request, "Unable to review welfare request", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "welfare.approve");
    if (access.response) return access.response;
    const id = Number(payload.id);
    const decision = clean(payload.decision, 20);
    if (!Number.isInteger(id) || !["Approved", "Rejected"].includes(decision)) throw new ApiError(400, "Choose a valid welfare decision");
    const db = await getDb();
    const [record] = await db.select().from(welfareRequests).where(eq(welfareRequests.id, id)).limit(1);
    if (!record || record.status !== "Pending assessment") throw new ApiError(409, "This request is no longer awaiting review");
    if (record.requestedByUserId === access.user!.id) throw new ApiError(403, "You cannot approve a welfare request you created");
    const reason = clean(payload.reason, 500);
    if (decision === "Rejected" && reason.length < 5) throw new ApiError(400, "Give a reason for rejection");
    const approvedPesewas = decision === "Approved" ? money(payload.amountApproved) : null;
    if (approvedPesewas && approvedPesewas > record.amountRequestedPesewas) throw new ApiError(400, "Approved amount cannot exceed the requested amount");
    let financeTransactionId: number | null = null;
    if (decision === "Approved") {
      const [fund] = await db.select().from(financeFunds).where(eq(financeFunds.code, "WF")).limit(1);
      if (!fund || fund.status !== "Active") throw new ApiError(409, "The Welfare Fund is not active");
      const reference = `CF-WEL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const [entry] = await db.insert(financeTransactions).values({
        reference, type: "Expense", category: "Welfare Support", fundId: fund.id,
        amountPesewas: approvedPesewas!, transactionDate: new Date().toISOString().slice(0, 10),
        paymentMethod: clean(payload.paymentMethod, 30) || "Mobile Money",
        description: `Welfare disbursement ${record.requestCode}`, payerPayee: record.beneficiaryName,
        status: "Pending", recordedBy: access.user!.name, recordedByUserId: access.user!.id, recordedByEmail: access.user!.email,
      }).returning({ id: financeTransactions.id });
      financeTransactionId = entry.id;
    }
    const updated = await db.update(welfareRequests).set({
      amountApprovedPesewas: approvedPesewas, decisionReason: reason || null,
      status: decision === "Approved" ? "Disbursement pending" : "Rejected",
      financeTransactionId, reviewedByUserId: access.user!.id, reviewedByName: access.user!.name,
      reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }).where(and(eq(welfareRequests.id, id), eq(welfareRequests.status, "Pending assessment"))).returning({ id: welfareRequests.id });
    if (!updated.length) throw new ApiError(409, "This request was reviewed by another user");
    await writeAudit(access.user!, `welfare.request.${decision.toLowerCase()}`, "welfare_request", id, requestId, { requestCode: record.requestCode, financeTransactionId });
    return apiJson({ requests: await listRequests() }, 200, requestId);
  });
}
