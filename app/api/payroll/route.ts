import { asc, count, eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  cfPayrollStaff,
  cfPayrollRuns,
  cfPayrollItems,
  cfFinanceFunds,
  cfFinanceTransactions,
  cfMembers,
} from "../../../db/schema-platform";
import { withTenantContext, writeTenantAudit } from "../_tenant";
import { ApiError, apiJson, readJson } from "../_security";
import type { PlatformUser } from "../../lib/auth-platform";

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const money = (value: unknown, allowZero = false) => {
  const amount = Number(value);
  if (
    !Number.isFinite(amount) ||
    amount < (allowZero ? 0 : 0.01) ||
    amount > 10_000_000
  )
    throw new ApiError(400, "Enter a valid payroll amount");
  return Math.round(amount * 100);
};

async function listPayroll(tenantId: string) {
  const db = await getDb();

  const staffRows = await db
    .select()
    .from(cfPayrollStaff)
    .where(eq(cfPayrollStaff.tenantId, tenantId))
    .orderBy(asc(cfPayrollStaff.fullName));

  const runRows = await db
    .select()
    .from(cfPayrollRuns)
    .where(eq(cfPayrollRuns.tenantId, tenantId))
    .orderBy(
      asc(cfPayrollRuns.status),
      asc(cfPayrollRuns.payPeriod)
    );

  return {
    staff: staffRows.map((staff) => ({
      id: staff.id,
      code: staff.staffCode,
      fullName: staff.fullName,
      jobTitle: staff.jobTitle,
      department: staff.department,
      employmentType: staff.employmentType,
      bankName: staff.bankName,
      paymentAccount: staff.bankAccountLast4
        ? `•••• ${staff.bankAccountLast4}`
        : staff.mobileMoneyNumber || "Not configured",
      baseSalary: staff.baseSalaryPesewas / 100,
      recurringAllowance: staff.recurringAllowancePesewas / 100,
      recurringDeduction: staff.recurringDeductionPesewas / 100,
      status: staff.status,
    })),
    runs: await Promise.all(
      runRows.map(async (run) => ({
        id: run.id,
        code: run.runCode,
        payPeriod: run.payPeriod,
        paymentDate: run.paymentDate,
        status: run.status,
        gross: run.grossPesewas / 100,
        deductions: run.deductionsPesewas / 100,
        net: run.netPesewas / 100,
        preparedByName: run.preparedByName,
        approvedByName: run.approvedByName,
        approvedAt: run.approvedAt,
        decisionReason: run.decisionReason,
        financeTransactionId: run.financeTransactionId,
        itemCount: (
          await db
            .select({ value: count() })
            .from(cfPayrollItems)
            .where(eq(cfPayrollItems.payrollRunId, run.id))
        )[0].value,
      }))
    ),
  };
}

export async function GET(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const result = await listPayroll(tenantId);
      return apiJson(result, 200, requestId);
    },
    { permission: "payroll:read" }
  );
}

export async function POST(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<Record<string, unknown>>(request);
      const db = await getDb();

      if (payload.action === "createRun") {
        const payPeriod = clean(payload.payPeriod, 7);
        const paymentDate = clean(payload.paymentDate, 10);
        if (
          !/^\d{4}-\d{2}$/.test(payPeriod) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)
        )
          throw new ApiError(
            400,
            "Enter a valid pay period and payment date"
          );

        const [duplicate] = await db
          .select()
          .from(cfPayrollRuns)
          .where(
            and(
              eq(cfPayrollRuns.payPeriod, payPeriod),
              eq(cfPayrollRuns.tenantId, tenantId)
            )
          )
          .limit(1);
        if (duplicate && duplicate.status !== "Rejected")
          throw new ApiError(
            409,
            "A payroll run already exists for this period"
          );

        const active = await db
          .select()
          .from(cfPayrollStaff)
          .where(
            and(
              eq(cfPayrollStaff.tenantId, tenantId),
              eq(cfPayrollStaff.status, "Active")
            )
          );
        if (!active.length)
          throw new ApiError(
            409,
            "Add active staff before preparing payroll"
          );

        const gross = active.reduce(
          (sum, staff) =>
            sum +
            staff.baseSalaryPesewas +
            staff.recurringAllowancePesewas,
          0
        );
        const deductions = active.reduce(
          (sum, staff) =>
            sum + staff.recurringDeductionPesewas,
          0
        );
        const runCode = `PAY-${payPeriod.replace("-", "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

        const [run] = await db
          .insert(cfPayrollRuns)
          .values({
            tenantId,
            runCode,
            payPeriod,
            paymentDate,
            status: "Pending",
            grossPesewas: gross,
            deductionsPesewas: deductions,
            netPesewas: gross - deductions,
            preparedByUserId: user.identityId,
            preparedByName: user.fullName,
          })
          .returning({ id: cfPayrollRuns.id });

        await db.insert(cfPayrollItems).values(
          active.map((staff) => ({
            tenantId,
            payrollRunId: run.id,
            staffId: staff.id,
            baseSalaryPesewas: staff.baseSalaryPesewas,
            allowancesPesewas: staff.recurringAllowancePesewas,
            deductionsPesewas: staff.recurringDeductionPesewas,
            netPayPesewas:
              staff.baseSalaryPesewas +
              staff.recurringAllowancePesewas -
              staff.recurringDeductionPesewas,
          }))
        );

        await writeTenantAudit(
          tenantId,
          user,
          "payroll.run.create",
          "payroll_run",
          String(run.id),
          `Created payroll run: ${runCode}`
        );

        return apiJson(
          { ...(await listPayroll(tenantId)) },
          201,
          requestId
        );
      }

      // Create staff
      const memberChurchId = clean(payload.memberChurchId, 30);
      const fullName = clean(payload.fullName, 120);
      const jobTitle = clean(payload.jobTitle, 100);
      const department = clean(payload.department, 100);
      if ((!memberChurchId && !fullName) || !jobTitle || !department)
        throw new ApiError(
          400,
          "Staff member, job title and department are required"
        );

      let memberId: number | null = null;
      let resolvedName = fullName;

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
          throw new ApiError(404, "Selected member was not found");
        memberId = member.id;
        resolvedName = member.name;
      }

      const staffCode = `STF-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

      const [staff] = await db
        .insert(cfPayrollStaff)
        .values({
          tenantId,
          staffCode,
          memberId,
          fullName: resolvedName,
          jobTitle,
          department,
          employmentType:
            clean(payload.employmentType, 30) || "Full-time",
          bankName: clean(payload.bankName, 80) || null,
          bankAccountLast4:
            clean(payload.bankAccountLast4, 4) || null,
          mobileMoneyNumber:
            clean(payload.mobileMoneyNumber, 30) || null,
          baseSalaryPesewas: money(payload.baseSalary),
          recurringAllowancePesewas: money(
            payload.recurringAllowance || 0,
            true
          ),
          recurringDeductionPesewas: money(
            payload.recurringDeduction || 0,
            true
          ),
          createdByUserId: user.identityId,
          createdByName: user.fullName,
        })
        .returning({ id: cfPayrollStaff.id });

      await writeTenantAudit(
        tenantId,
        user,
        "payroll.staff.create",
        "payroll_staff",
        String(staff.id),
        `Created staff: ${staffCode}`
      );

      return apiJson(
        { ...(await listPayroll(tenantId)) },
        201,
        requestId
      );
    },
    { permission: "payroll:write" }
  );
}

export async function PATCH(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload =
        await readJson<Record<string, unknown>>(request);
      const id = Number(payload.id);
      const decision = clean(payload.decision, 20);
      if (
        !Number.isInteger(id) ||
        !["Approved", "Rejected"].includes(decision)
      )
        throw new ApiError(
          400,
          "Choose a valid payroll decision"
        );

      const db = await getDb();
      const [run] = await db
        .select()
        .from(cfPayrollRuns)
        .where(
          and(
            eq(cfPayrollRuns.id, id),
            eq(cfPayrollRuns.tenantId, tenantId)
          )
        )
        .limit(1);
      if (!run || run.status !== "Pending")
        throw new ApiError(
          409,
          "This payroll is no longer awaiting approval"
        );
      if (run.preparedByUserId === user.identityId)
        throw new ApiError(
          403,
          "You cannot approve a payroll run you prepared"
        );

      const reason = clean(payload.reason, 500);
      if (decision === "Rejected" && reason.length < 5)
        throw new ApiError(
          400,
          "Give a reason for rejection"
        );

      let financeTransactionId: number | null = null;
      if (decision === "Approved") {
        const [fund] = await db
          .select()
          .from(cfFinanceFunds)
          .where(
            and(
              eq(cfFinanceFunds.code, "GF"),
              eq(cfFinanceFunds.tenantId, tenantId)
            )
          )
          .limit(1);
        if (!fund || fund.status !== "Active")
          throw new ApiError(
            409,
            "The General Fund is not active"
          );

        const [entry] = await db
          .insert(cfFinanceTransactions)
          .values({
            tenantId,
            reference: `CF-PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            type: "Expense",
            category: "Payroll",
            fundId: fund.id,
            amountPesewas: run.netPesewas,
            transactionDate: run.paymentDate,
            paymentMethod: "Bank transfer",
            description: `Payroll ${run.payPeriod}`,
            payerPayee: "Church staff payroll",
            status: "Pending",
            recordedBy: user.fullName,
            recordedByUserId: user.identityId,
            recordedByEmail: user.email,
          })
          .returning({ id: cfFinanceTransactions.id });
        financeTransactionId = entry.id;
      }

      const updated = await db
        .update(cfPayrollRuns)
        .set({
          status:
            decision === "Approved"
              ? "Disbursement pending"
              : "Rejected",
          approvedByUserId: user.identityId,
          approvedByName: user.fullName,
          approvedAt: new Date().toISOString(),
          decisionReason: reason || null,
          financeTransactionId,
        })
        .where(
          and(
            eq(cfPayrollRuns.id, id),
            eq(cfPayrollRuns.status, "Pending"),
            eq(cfPayrollRuns.tenantId, tenantId)
          )
        )
        .returning({ id: cfPayrollRuns.id });

      if (!updated.length)
        throw new ApiError(
          409,
          "This payroll was reviewed by another user"
        );

      await writeTenantAudit(
        tenantId,
        user,
        `payroll.run.${decision.toLowerCase()}`,
        "payroll_run",
        String(id),
        `${decision}: ${run.runCode}`
      );

      return apiJson(
        { ...(await listPayroll(tenantId)) },
        200,
        requestId
      );
    },
    { permission: "payroll:approve" }
  );
}
