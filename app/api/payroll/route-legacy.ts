import { asc, count, eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import { financeFunds, financeTransactions, members, payrollItems, payrollRuns, payrollStaff } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const money = (value: unknown, allowZero = false) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < (allowZero ? 0 : 0.01) || amount > 10_000_000) throw new ApiError(400, "Enter a valid payroll amount");
  return Math.round(amount * 100);
};

async function seedIfEmpty(actorId: number, actorName: string) {
  const db = await getDb();
  const [total] = await db.select({ value: count() }).from(payrollStaff);
  if (total.value) return;
  const people = await db.select().from(members).orderBy(asc(members.id));
  await db.insert(payrollStaff).values([
    { staffCode: "STF-001", memberId: people[0]?.id, fullName: people[0]?.name || "Akosua Mensah", jobTitle: "Church Administrator", department: "Administration", employmentType: "Full-time", bankName: "GCB Bank", bankAccountLast4: "4821", baseSalaryPesewas: 320000, recurringAllowancePesewas: 35000, recurringDeductionPesewas: 18000, createdByUserId: actorId, createdByName: actorName },
    { staffCode: "STF-002", memberId: people[1]?.id, fullName: people[1]?.name || "Kwame Owusu", jobTitle: "Facilities Coordinator", department: "Operations", employmentType: "Part-time", mobileMoneyNumber: "•••• 8821", baseSalaryPesewas: 180000, recurringAllowancePesewas: 15000, recurringDeductionPesewas: 5000, createdByUserId: actorId, createdByName: actorName },
  ]);
}

async function listPayroll() {
  const db = await getDb();
  const staffRows = await db.select().from(payrollStaff).orderBy(asc(payrollStaff.fullName));
  const runRows = await db.select().from(payrollRuns).orderBy(asc(payrollRuns.status), asc(payrollRuns.payPeriod));
  return {
    staff: staffRows.map((staff) => ({
      id: staff.id, code: staff.staffCode, fullName: staff.fullName, jobTitle: staff.jobTitle,
      department: staff.department, employmentType: staff.employmentType, bankName: staff.bankName,
      paymentAccount: staff.bankAccountLast4 ? `•••• ${staff.bankAccountLast4}` : staff.mobileMoneyNumber || "Not configured",
      baseSalary: staff.baseSalaryPesewas / 100, recurringAllowance: staff.recurringAllowancePesewas / 100,
      recurringDeduction: staff.recurringDeductionPesewas / 100, status: staff.status,
    })),
    runs: await Promise.all(runRows.map(async (run) => ({
      id: run.id, code: run.runCode, payPeriod: run.payPeriod, paymentDate: run.paymentDate, status: run.status,
      gross: run.grossPesewas / 100, deductions: run.deductionsPesewas / 100, net: run.netPesewas / 100,
      preparedByUserId: run.preparedByUserId, preparedByName: run.preparedByName,
      approvedByName: run.approvedByName, approvedAt: run.approvedAt, decisionReason: run.decisionReason,
      financeTransactionId: run.financeTransactionId,
      itemCount: (await db.select({ value: count() }).from(payrollItems).where(eq(payrollItems.payrollRunId, run.id)))[0].value,
    }))),
  };
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load payroll", async (requestId) => {
    const access = await requirePermission(request, "payroll.read");
    if (access.response) return access.response;
    await seedIfEmpty(access.user!.id, access.user!.name);
    return apiJson(await listPayroll(), 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to update payroll", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "payroll.manage");
    if (access.response) return access.response;
    const db = await getDb();
    if (payload.action === "createRun") {
      const payPeriod = clean(payload.payPeriod, 7);
      const paymentDate = clean(payload.paymentDate, 10);
      if (!/^\d{4}-\d{2}$/.test(payPeriod) || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) throw new ApiError(400, "Enter a valid pay period and payment date");
      const [duplicate] = await db.select().from(payrollRuns).where(eq(payrollRuns.payPeriod, payPeriod)).limit(1);
      if (duplicate && !["Rejected"].includes(duplicate.status)) throw new ApiError(409, "A payroll run already exists for this period");
      const active = await db.select().from(payrollStaff).where(eq(payrollStaff.status, "Active"));
      if (!active.length) throw new ApiError(409, "Add active staff before preparing payroll");
      const gross = active.reduce((sum, staff) => sum + staff.baseSalaryPesewas + staff.recurringAllowancePesewas, 0);
      const deductions = active.reduce((sum, staff) => sum + staff.recurringDeductionPesewas, 0);
      const runCode = `PAY-${payPeriod.replace("-", "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      const [run] = await db.insert(payrollRuns).values({ runCode, payPeriod, paymentDate, status: "Pending", grossPesewas: gross, deductionsPesewas: deductions, netPesewas: gross - deductions, preparedByUserId: access.user!.id, preparedByName: access.user!.name }).returning({ id: payrollRuns.id });
      await db.insert(payrollItems).values(active.map((staff) => ({ payrollRunId: run.id, staffId: staff.id, baseSalaryPesewas: staff.baseSalaryPesewas, allowancesPesewas: staff.recurringAllowancePesewas, deductionsPesewas: staff.recurringDeductionPesewas, netPayPesewas: staff.baseSalaryPesewas + staff.recurringAllowancePesewas - staff.recurringDeductionPesewas })));
      await writeAudit(access.user!, "payroll.run.submitted", "payroll_run", run.id, requestId, { runCode, payPeriod, staffCount: active.length });
      return apiJson({ ...(await listPayroll()) }, 201, requestId);
    }
    const memberChurchId = clean(payload.memberChurchId, 30);
    const fullName = clean(payload.fullName, 120);
    const jobTitle = clean(payload.jobTitle, 100);
    const department = clean(payload.department, 100);
    if ((!memberChurchId && !fullName) || !jobTitle || !department) throw new ApiError(400, "Staff member, job title and department are required");
    const [member] = memberChurchId ? await db.select().from(members).where(eq(members.churchId, memberChurchId)).limit(1) : [];
    if (memberChurchId && !member) throw new ApiError(404, "Selected member was not found");
    const staffCode = `STF-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const [staff] = await db.insert(payrollStaff).values({
      staffCode, memberId: member?.id, fullName: member?.name || fullName, jobTitle, department,
      employmentType: clean(payload.employmentType, 30) || "Full-time", bankName: clean(payload.bankName, 80) || null,
      bankAccountLast4: clean(payload.bankAccountLast4, 4) || null, mobileMoneyNumber: clean(payload.mobileMoneyNumber, 30) || null,
      baseSalaryPesewas: money(payload.baseSalary), recurringAllowancePesewas: money(payload.recurringAllowance || 0, true),
      recurringDeductionPesewas: money(payload.recurringDeduction || 0, true), createdByUserId: access.user!.id, createdByName: access.user!.name,
    }).returning({ id: payrollStaff.id });
    await writeAudit(access.user!, "payroll.staff.created", "payroll_staff", staff.id, requestId, { staffCode, department });
    return apiJson({ ...(await listPayroll()) }, 201, requestId);
  });
}

export async function PATCH(request: Request) {
  return safeApi(request, "Unable to review payroll", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    const access = await requirePermission(request, "payroll.approve");
    if (access.response) return access.response;
    const id = Number(payload.id);
    const decision = clean(payload.decision, 20);
    if (!Number.isInteger(id) || !["Approved", "Rejected"].includes(decision)) throw new ApiError(400, "Choose a valid payroll decision");
    const db = await getDb();
    const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).limit(1);
    if (!run || run.status !== "Pending") throw new ApiError(409, "This payroll is no longer awaiting approval");
    if (run.preparedByUserId === access.user!.id) throw new ApiError(403, "You cannot approve a payroll run you prepared");
    const reason = clean(payload.reason, 500);
    if (decision === "Rejected" && reason.length < 5) throw new ApiError(400, "Give a reason for rejection");
    let financeTransactionId: number | null = null;
    if (decision === "Approved") {
      const [fund] = await db.select().from(financeFunds).where(eq(financeFunds.code, "GF")).limit(1);
      if (!fund || fund.status !== "Active") throw new ApiError(409, "The General Fund is not active");
      const [entry] = await db.insert(financeTransactions).values({
        reference: `CF-PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, type: "Expense", category: "Payroll",
        fundId: fund.id, amountPesewas: run.netPesewas, transactionDate: run.paymentDate,
        paymentMethod: "Bank transfer", description: `Payroll ${run.payPeriod}`, payerPayee: "Church staff payroll",
        status: "Pending", recordedBy: access.user!.name, recordedByUserId: access.user!.id, recordedByEmail: access.user!.email,
      }).returning({ id: financeTransactions.id });
      financeTransactionId = entry.id;
    }
    const updated = await db.update(payrollRuns).set({
      status: decision === "Approved" ? "Disbursement pending" : "Rejected", approvedByUserId: access.user!.id,
      approvedByName: access.user!.name, approvedAt: new Date().toISOString(), decisionReason: reason || null, financeTransactionId,
    }).where(and(eq(payrollRuns.id, id), eq(payrollRuns.status, "Pending"))).returning({ id: payrollRuns.id });
    if (!updated.length) throw new ApiError(409, "This payroll was reviewed by another user");
    await writeAudit(access.user!, `payroll.run.${decision.toLowerCase()}`, "payroll_run", id, requestId, { runCode: run.runCode, financeTransactionId });
    return apiJson({ ...(await listPayroll()) }, 200, requestId);
  });
}
