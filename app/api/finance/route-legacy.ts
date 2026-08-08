import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { financeFunds, financeTransactions } from "../../../db/schema";
import { requirePermission, type AccessUser } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, readJson, safeApi } from "../_security";
import { resolveTenantContext, checkTenantPermission, type TenantContext } from "../_tenant-compat";

const TYPES = ["Income", "Expense"] as const;
const METHODS = ["Cash", "Mobile Money", "Bank transfer", "Cheque", "Card"] as const;
const CATEGORIES = [
  "Tithe", "Sunday Offering", "Special Offering", "Missions Offering", "Welfare Contribution",
  "Utilities", "Programme Expense", "Welfare Support", "Maintenance", "Payroll", "Other",
] as const;

function text(value: unknown, label: string, max: number, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new ApiError(400, `${label} is required`);
  if (result.length > max) throw new ApiError(400, `${label} is too long`);
  return result;
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) throw new ApiError(400, `${label} is invalid`);
  return value as T[number];
}

function parsePesewas(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(raw)) {
    throw new ApiError(400, "Amount must be a positive GHS value with no more than two decimal places");
  }
  const [cedis, decimal = ""] = raw.split(".");
  const amount = Number(cedis) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100_000_000_000) {
    throw new ApiError(400, "Amount is outside the allowed range");
  }
  return amount;
}

function parseDate(value: unknown) {
  const date = text(value, "Transaction date", 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new ApiError(400, "Transaction date is invalid");
  }
  return date;
}

function parseId(value: unknown, label = "Record") {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, `${label} is invalid`);
  return id;
}

async function seedIfEmpty(user: AccessUser) {
  const db = await getDb();
  const [fundCount] = await db.select({ value: count() }).from(financeFunds);
  if (!fundCount.value) {
    await db.insert(financeFunds).values([
      { name: "General Fund", code: "GF", purpose: "Core church operations and administration" },
      { name: "Missions Fund", code: "MF", purpose: "Missions, outreach and evangelism" },
      { name: "Welfare Fund", code: "WF", purpose: "Member care and welfare support" },
      { name: "Building Fund", code: "BF", purpose: "Facilities and capital projects" },
    ]);
  }
  const [transactionCount] = await db.select({ value: count() }).from(financeTransactions);
  if (transactionCount.value) return;
  const funds = await db.select().from(financeFunds).orderBy(asc(financeFunds.id));
  const byCode = Object.fromEntries(funds.map((fund) => [fund.code, fund]));
  const importedAt = new Date().toISOString();
  await db.insert(financeTransactions).values([
    { reference: "CF-INC-260729-001", type: "Income", category: "Tithe", fundId: byCode.GF.id, amountPesewas: 935000, transactionDate: "2026-07-29", paymentMethod: "Bank transfer", description: "Weekly tithe deposits", receiptNumber: "RC-1048", status: "Approved", recordedBy: "Legacy import", approvedBy: "Legacy import", approvedAt: importedAt, immutableAt: importedAt },
    { reference: "CF-INC-260727-002", type: "Income", category: "Sunday Offering", fundId: byCode.GF.id, amountPesewas: 482000, transactionDate: "2026-07-27", paymentMethod: "Cash", description: "Sunday celebration offering", receiptNumber: "RC-1047", status: "Approved", recordedBy: "Legacy import", approvedBy: "Legacy import", approvedAt: importedAt, immutableAt: importedAt },
    { reference: "CF-EXP-260728-003", type: "Expense", category: "Utilities", fundId: byCode.GF.id, amountPesewas: 126500, transactionDate: "2026-07-28", paymentMethod: "Mobile Money", description: "Electricity and water", payerPayee: "Utility providers", status: "Pending", recordedBy: user.name, recordedByUserId: user.id, recordedByEmail: user.email },
    { reference: "CF-INC-260726-004", type: "Income", category: "Missions Offering", fundId: byCode.MF.id, amountPesewas: 214000, transactionDate: "2026-07-26", paymentMethod: "Cash", description: "Monthly missions contribution", receiptNumber: "RC-1046", status: "Approved", recordedBy: "Legacy import", approvedBy: "Legacy import", approvedAt: importedAt, immutableAt: importedAt },
  ]);
}

async function loadFinance() {
  const db = await getDb();
  const fundRows = await db.select().from(financeFunds).orderBy(asc(financeFunds.name));
  const rows = await db.select({
    id: financeTransactions.id, reference: financeTransactions.reference, type: financeTransactions.type,
    category: financeTransactions.category, fundId: financeTransactions.fundId, fundName: financeFunds.name,
    amountPesewas: financeTransactions.amountPesewas, transactionDate: financeTransactions.transactionDate,
    paymentMethod: financeTransactions.paymentMethod, description: financeTransactions.description,
    payerPayee: financeTransactions.payerPayee, receiptNumber: financeTransactions.receiptNumber,
    status: financeTransactions.status, recordedBy: financeTransactions.recordedBy,
    recordedByUserId: financeTransactions.recordedByUserId, recordedByEmail: financeTransactions.recordedByEmail,
    approvedBy: financeTransactions.approvedBy, approvedByUserId: financeTransactions.approvedByUserId,
    approvedByEmail: financeTransactions.approvedByEmail, approvedAt: financeTransactions.approvedAt,
    decisionReason: financeTransactions.decisionReason, reversalOfId: financeTransactions.reversalOfId,
    reversalReason: financeTransactions.reversalReason, createdAt: financeTransactions.createdAt,
  }).from(financeTransactions).leftJoin(financeFunds, eq(financeTransactions.fundId, financeFunds.id))
    .orderBy(desc(financeTransactions.transactionDate), desc(financeTransactions.id));
  const transactions = rows.map((row) => ({ ...row, amount: row.amountPesewas / 100, fundName: row.fundName || "Unknown fund" }));
  const funds = fundRows.map((fund) => {
    const approved = transactions.filter((item) => item.fundId === fund.id && item.status === "Approved");
    const income = approved.filter((item) => item.type === "Income").reduce((sum, item) => sum + item.amount, 0);
    const expenses = approved.filter((item) => item.type === "Expense").reduce((sum, item) => sum + item.amount, 0);
    return { ...fund, income, expenses, balance: income - expenses };
  });
  return { funds, transactions };
}

function referenceFor(type: "Income" | "Expense", date: string) {
  return `CF-${type === "Expense" ? "EXP" : "INC"}-${date.replaceAll("-", "").slice(2)}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load finance records", async (requestId) => {
    // Try tenant context first, fall back to legacy auth
    const tenantContext = await resolveTenantContext(request);
    
    if (tenantContext) {
      // Tenant-scoped access
      const hasPermission = await checkTenantPermission(tenantContext, "finance.read");
      if (!hasPermission) {
        return apiJson({ error: "Insufficient permissions" }, 403, requestId);
      }
      
      await seedIfEmpty({ name: "System", id: 0, email: "system@nexora.com" } as AccessUser);
      const financeData = await loadFinance();
      return apiJson({ ...financeData, tenant: tenantContext.tenant }, 200, requestId);
    }
    
    // Legacy auth fallback
    const access = await requirePermission(request, "finance.read");
    if (access.response) return access.response;
    await seedIfEmpty(access.user!);
    return apiJson(await loadFinance(), 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to record transaction", async (requestId) => {
    const payload = await readJson<Record<string, unknown>>(request);
    
    // Try tenant context first, fall back to legacy auth
    const tenantContext = await resolveTenantContext(request);
    let access: { user: AccessUser | null; response?: Response } = { user: null };
    
    if (tenantContext) {
      // Tenant-scoped access
      const hasPermission = await checkTenantPermission(tenantContext, payload.action === "reverse" ? "finance.approve" : "finance.write");
      if (!hasPermission) {
        return apiJson({ error: "Insufficient permissions" }, 403, requestId);
      }
      // Create a mock access user for compatibility
      access.user = {
        id: 0,
        name: tenantContext.user.email,
        email: tenantContext.user.email,
        role: "super_admin",
        roleLabel: "Tenant User",
        campus: tenantContext.tenant.name,
        status: "Active",
        memberId: null,
        permissions: [],
      };
    } else {
      // Legacy auth fallback
      access = await requirePermission(request, payload.action === "reverse" ? "finance.reverse" : "finance.write");
      if (access.response) return access.response;
    }
    
    if (payload.action === "reverse") {
      const originalId = parseId(payload.id, "Original transaction");
      const reason = text(payload.reason, "Reversal reason", 500, true);
      if (reason.length < 10) throw new ApiError(400, "Reversal reason must contain at least 10 characters");
      const db = await getDb();
      const [original] = await db.select().from(financeTransactions).where(eq(financeTransactions.id, originalId)).limit(1);
      if (!original) throw new ApiError(404, "Original transaction was not found");
      if (original.status !== "Approved" || original.reversalOfId) throw new ApiError(409, "Only an original approved transaction can be reversed");
      const [existing] = await db.select({ id: financeTransactions.id }).from(financeTransactions)
        .where(and(eq(financeTransactions.reversalOfId, originalId), inArray(financeTransactions.status, ["Pending", "Approved"]))).limit(1);
      if (existing) throw new ApiError(409, "A reversal already exists for this transaction");
      const reversalReference = referenceFor(original.type === "Income" ? "Expense" : "Income", new Date().toISOString().slice(0, 10));
      const [created] = await db.insert(financeTransactions).values({
        reference: reversalReference,
        type: original.type === "Income" ? "Expense" : "Income",
        category: "Other",
        fundId: original.fundId,
        amountPesewas: original.amountPesewas,
        transactionDate: new Date().toISOString().slice(0, 10),
        paymentMethod: original.paymentMethod,
        description: `Reversal of ${original.reference}`,
        status: "Pending",
        recordedBy: access.user!.name,
        recordedByUserId: access.user!.id,
        recordedByEmail: access.user!.email,
        reversalOfId: original.id,
        reversalReason: reason,
      }).returning({ id: financeTransactions.id });
      await writeAudit(access.user!, "finance.reversal.requested", "finance_transaction", created.id, requestId, { reference: reversalReference, originalReference: original.reference, amountPesewas: original.amountPesewas });
      const data = await loadFinance();
      return apiJson({ transaction: data.transactions.find((item) => item.id === created.id), ...data }, 201, requestId);
    }

    // For non-reverse actions, check finance.write permission
    if (!tenantContext) {
      const writeAccess = await requirePermission(request, "finance.create");
      if (writeAccess.response) return writeAccess.response;
      access = writeAccess;
    }
    
    const type = oneOf(payload.type, TYPES, "Transaction type");
    const category = oneOf(payload.category, CATEGORIES, "Category");
    const paymentMethod = oneOf(payload.paymentMethod || "Cash", METHODS, "Payment method");
    const amountPesewas = parsePesewas(payload.amount);
    const transactionDate = parseDate(payload.transactionDate);
    const fundId = parseId(payload.fundId, "Fund");
    const description = text(payload.description, "Description", 240, true);
    const payerPayee = text(payload.payerPayee, "Payer or payee", 160);
    const receiptNumber = text(payload.receiptNumber, "Receipt number", 80);
    const db = await getDb();
    const [fund] = await db.select().from(financeFunds).where(eq(financeFunds.id, fundId)).limit(1);
    if (!fund || fund.status !== "Active") throw new ApiError(400, "Select an active finance fund");
    const reference = referenceFor(type, transactionDate);
    const [created] = await db.insert(financeTransactions).values({
      reference, type, category, fundId, amountPesewas, transactionDate, paymentMethod, description,
      payerPayee: payerPayee || null, receiptNumber: receiptNumber || null, status: "Pending",
      recordedBy: access.user!.name, recordedByUserId: access.user!.id, recordedByEmail: access.user!.email,
    }).returning({ id: financeTransactions.id });
    await writeAudit(access.user!, "finance.transaction.created", "finance_transaction", created.id, requestId, { reference, fund: fund.code, amountPesewas });
    const data = await loadFinance();
    return apiJson({ transaction: data.transactions.find((item) => item.id === created.id), ...data }, 201, requestId);
  });
}

export async function PATCH(request: Request) {
  return safeApi(request, "Unable to update transaction", async (requestId) => {
    const payload = await readJson<{ id?: unknown; status?: unknown; reason?: unknown }>(request);
    
    // Try tenant context first, fall back to legacy auth
    const tenantContext = await resolveTenantContext(request);
    let access: { user: AccessUser | null; response?: Response } = { user: null };
    
    if (tenantContext) {
      // Tenant-scoped access
      const hasPermission = await checkTenantPermission(tenantContext, "finance.approve");
      if (!hasPermission) {
        return apiJson({ error: "Insufficient permissions" }, 403, requestId);
      }
      // Create a mock access user for compatibility
      access.user = {
        id: 0,
        name: tenantContext.user.email,
        email: tenantContext.user.email,
        role: "super_admin",
        roleLabel: "Tenant User",
        campus: tenantContext.tenant.name,
        status: "Active",
        memberId: null,
        permissions: [],
      };
    } else {
      // Legacy auth fallback
      access = await requirePermission(request, "finance.approve");
      if (access.response) return access.response;
    }
    const id = parseId(payload.id, "Transaction");
    const status = oneOf(payload.status, ["Approved", "Rejected"] as const, "Decision");
    const reason = text(payload.reason, "Decision reason", 500, status === "Rejected");
    const db = await getDb();
    const [transaction] = await db.select().from(financeTransactions).where(eq(financeTransactions.id, id)).limit(1);
    if (!transaction) throw new ApiError(404, "Transaction was not found");
    if (transaction.status !== "Pending") throw new ApiError(409, "This transaction has already been decided and is immutable");
    if (
      transaction.recordedByUserId === access.user!.id ||
      Boolean(transaction.recordedByEmail && transaction.recordedByEmail === access.user!.email)
    ) throw new ApiError(409, "Independent approval is required; creators cannot approve their own entries");
    const now = new Date().toISOString();
    const decided = await db.update(financeTransactions).set({
      status,
      approvedBy: access.user!.name,
      approvedByUserId: access.user!.id,
      approvedByEmail: access.user!.email,
      approvedAt: now,
      decisionReason: reason || null,
      immutableAt: now,
    }).where(and(eq(financeTransactions.id, id), eq(financeTransactions.status, "Pending")))
      .returning({ id: financeTransactions.id });
    if (decided.length !== 1) throw new ApiError(409, "Another approver has already decided this transaction");
    const action = transaction.reversalOfId && status === "Approved"
      ? "finance.reversal.approved"
      : `finance.transaction.${status.toLowerCase()}`;
    await writeAudit(access.user!, action, "finance_transaction", id, requestId, { reference: transaction.reference, amountPesewas: transaction.amountPesewas, decision: status });
    return apiJson(await loadFinance(), 200, requestId);
  });
}
