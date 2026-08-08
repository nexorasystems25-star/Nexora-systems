import { and, asc, count, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { cfFinanceFunds, cfFinanceTransactions } from "../../../db/schema-platform";
import { withTenantContext, writeTenantAudit } from "../_tenant";
import { ApiError, apiJson, readJson, safeApi } from "../_security";
import type { PlatformUser } from "../../lib/auth-platform";

// ============================================================================
// FINANCE API - Tenant-Scoped
// ============================================================================
// All financial data is now scoped by tenant_id
// ============================================================================

const TYPES = ["Income", "Expense"] as const;
const METHODS = [
  "Cash",
  "Mobile Money",
  "Bank transfer",
  "Cheque",
  "Card",
] as const;
const CATEGORIES = [
  "Tithe",
  "Sunday Offering",
  "Special Offering",
  "Missions Offering",
  "Welfare Contribution",
  "Utilities",
  "Programme Expense",
  "Welfare Support",
  "Maintenance",
  "Payroll",
  "Other",
] as const;

function text(
  value: unknown,
  label: string,
  max: number,
  required = false
) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new ApiError(400, `${label} is required`);
  if (result.length > max) throw new ApiError(400, `${label} is too long`);
  return result;
}

function oneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value))
    throw new ApiError(400, `${label} is invalid`);
  return value as T[number];
}

function parsePesewas(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(raw)) {
    throw new ApiError(
      400,
      "Amount must be a positive GHS value with no more than two decimal places"
    );
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
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`))
  ) {
    throw new ApiError(400, "Transaction date is invalid");
  }
  return date;
}

async function loadFinance(tenantId: string) {
  const db = await getDb();

  // Tenant-scoped fund query
  const fundRows = await db
    .select()
    .from(cfFinanceFunds)
    .where(eq(cfFinanceFunds.tenantId, tenantId))
    .orderBy(asc(cfFinanceFunds.name));

  // Tenant-scoped transaction query
  const rows = await db
    .select({
      id: cfFinanceTransactions.id,
      reference: cfFinanceTransactions.reference,
      type: cfFinanceTransactions.type,
      category: cfFinanceTransactions.category,
      fundId: cfFinanceTransactions.fundId,
      fundName: cfFinanceFunds.name,
      amountPesewas: cfFinanceTransactions.amountPesewas,
      transactionDate: cfFinanceTransactions.transactionDate,
      paymentMethod: cfFinanceTransactions.paymentMethod,
      description: cfFinanceTransactions.description,
      payerPayee: cfFinanceTransactions.payerPayee,
      receiptNumber: cfFinanceTransactions.receiptNumber,
      status: cfFinanceTransactions.status,
      recordedBy: cfFinanceTransactions.recordedBy,
      recordedByUserId: cfFinanceTransactions.recordedByUserId,
      recordedByEmail: cfFinanceTransactions.recordedByEmail,
      approvedBy: cfFinanceTransactions.approvedBy,
      approvedByUserId: cfFinanceTransactions.approvedByUserId,
      approvedByEmail: cfFinanceTransactions.approvedByEmail,
      approvedAt: cfFinanceTransactions.approvedAt,
      decisionReason: cfFinanceTransactions.decisionReason,
      reversalOfId: cfFinanceTransactions.reversalOfId,
      reversalReason: cfFinanceTransactions.reversalReason,
      createdAt: cfFinanceTransactions.createdAt,
    })
    .from(cfFinanceTransactions)
    .leftJoin(
      cfFinanceFunds,
      eq(cfFinanceTransactions.fundId, cfFinanceFunds.id)
    )
    .where(eq(cfFinanceTransactions.tenantId, tenantId))
    .orderBy(
      desc(cfFinanceTransactions.transactionDate),
      desc(cfFinanceTransactions.id)
    );

  const transactions = rows.map((row) => ({
    ...row,
    amount: row.amountPesewas / 100,
    fundName: row.fundName || "Unknown fund",
  }));

  const funds = fundRows.map((fund) => {
    const approved = transactions.filter(
      (item) => item.fundId === fund.id && item.status === "Approved"
    );
    const income = approved
      .filter((item) => item.type === "Income")
      .reduce((sum, item) => sum + item.amount, 0);
    const expenses = approved
      .filter((item) => item.type === "Expense")
      .reduce((sum, item) => sum + item.amount, 0);
    return { ...fund, income, expenses, balance: income - expenses };
  });

  return { funds, transactions };
}

export async function GET(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const data = await loadFinance(tenantId);
      return apiJson(data, 200, requestId);
    },
    { permission: "finance:read" }
  );
}

export async function POST(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const payload = await readJson<Record<string, unknown>>(request);
      const action = String(payload.action || "");

      if (action === "create-fund") {
        return handleCreateFund(payload, tenantId, user, requestId);
      }
      if (action === "create-transaction") {
        return handleCreateTransaction(payload, tenantId, user, requestId);
      }
      if (action === "approve-transaction") {
        return handleApproveTransaction(payload, tenantId, user, requestId);
      }
      if (action === "reverse-transaction") {
        return handleReverseTransaction(payload, tenantId, user, requestId);
      }
      throw new ApiError(400, "Invalid action");
    },
    { permission: "finance:write" }
  );
}

async function handleCreateFund(
  payload: Record<string, unknown>,
  tenantId: string,
  user: PlatformUser,
  requestId: string
) {
  const name = text(payload.name, "Fund name", 100, true);
  const code = text(payload.code, "Fund code", 10, true);
  const purpose = text(payload.purpose, "Purpose", 400) || "General";

  const db = await getDb();

  // Check for duplicate code within tenant
  const [existing] = await db
    .select()
    .from(cfFinanceFunds)
    .where(
      eq(cfFinanceFunds.code, code) && eq(cfFinanceFunds.tenantId, tenantId)
    )
    .limit(1);

  if (existing) throw new ApiError(409, "Fund code already exists");

  const [fund] = await db
    .insert(cfFinanceFunds)
    .values({
      tenantId,
      name,
      code,
      purpose,
    })
    .returning();

  await writeTenantAudit(
    tenantId,
    user,
    "finance.fund.create",
    "fund",
    String(fund.id),
    `Created fund: ${name}`
  );

  return apiJson({ fund }, 201, requestId);
}

async function handleCreateTransaction(
  payload: Record<string, unknown>,
  tenantId: string,
  user: PlatformUser,
  requestId: string
) {
  const type = oneOf(payload.type, TYPES, "Transaction type");
  const category = oneOf(payload.category, CATEGORIES, "Category");
  const fundId = Number(payload.fundId);
  if (!Number.isSafeInteger(fundId) || fundId < 1)
    throw new ApiError(400, "Fund is required");

  const amountPesewas = parsePesewas(payload.amount);
  const transactionDate = parseDate(payload.date);
  const paymentMethod = oneOf(payload.method, METHODS, "Payment method");
  const description = text(payload.description, "Description", 300, true);

  // Verify fund belongs to this tenant
  const db = await getDb();
  const [fund] = await db
    .select()
    .from(cfFinanceFunds)
    .where(
      eq(cfFinanceFunds.id, fundId) && eq(cfFinanceFunds.tenantId, tenantId)
    )
    .limit(1);

  if (!fund) throw new ApiError(404, "Fund not found");

  // Generate reference
  const prefix = type === "Income" ? "INC" : "EXP";
  const datePart = transactionDate.replace(/-/g, "").slice(2);
  const [countResult] = await db
    .select({ value: count() })
    .from(cfFinanceTransactions)
    .where(
      eq(cfFinanceTransactions.tenantId, tenantId)
    );
  const seq = String((countResult?.value || 0) + 1).padStart(3, "0");
  const reference = `CF-${prefix}-${datePart}-${seq}`;

  const [transaction] = await db
    .insert(cfFinanceTransactions)
    .values({
      tenantId,
      reference,
      type,
      category,
      fundId,
      amountPesewas,
      transactionDate,
      paymentMethod,
      description,
      payerPayee: text(payload.payee, "Payer/Payee", 120) || null,
      receiptNumber: text(payload.receipt, "Receipt number", 50) || null,
      status: "Pending",
      recordedBy: user.fullName,
      recordedByUserId: undefined, // TODO: Link to cf_users
      recordedByEmail: user.email,
    })
    .returning();

  await writeTenantAudit(
    tenantId,
    user,
    "finance.transaction.create",
    "transaction",
    reference,
    `Created ${type.toLowerCase()} transaction: GHS ${(amountPesewas / 100).toFixed(2)}`
  );

  return apiJson({ transaction }, 201, requestId);
}

async function handleApproveTransaction(
  payload: Record<string, unknown>,
  tenantId: string,
  user: PlatformUser,
  requestId: string
) {
  const id = Number(payload.id);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new ApiError(400, "Transaction ID is required");

  const db = await getDb();

  // Verify transaction belongs to this tenant
  const [existing] = await db
    .select()
    .from(cfFinanceTransactions)
    .where(
      eq(cfFinanceTransactions.id, id) &&
        eq(cfFinanceTransactions.tenantId, tenantId)
    )
    .limit(1);

  if (!existing) throw new ApiError(404, "Transaction not found");
  if (existing.status !== "Pending")
    throw new ApiError(400, "Only pending transactions can be approved");

  const now = new Date().toISOString();
  const [updated] = await db
    .update(cfFinanceTransactions)
    .set({
      status: "Approved",
      approvedBy: user.fullName,
      approvedByUserId: undefined, // TODO: Link to cf_users
      approvedByEmail: user.email,
      approvedAt: now,
      immutableAt: now,
    })
    .where(eq(cfFinanceTransactions.id, id))
    .returning();

  await writeTenantAudit(
    tenantId,
    user,
    "finance.transaction.approve",
    "transaction",
    existing.reference,
    `Approved transaction: ${existing.reference}`
  );

  return apiJson({ transaction: updated }, 200, requestId);
}

async function handleReverseTransaction(
  payload: Record<string, unknown>,
  tenantId: string,
  user: PlatformUser,
  requestId: string
) {
  const id = Number(payload.id);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new ApiError(400, "Transaction ID is required");
  const reason = text(payload.reason, "Reversal reason", 400, true);

  const db = await getDb();

  // Verify transaction belongs to this tenant
  const [existing] = await db
    .select()
    .from(cfFinanceTransactions)
    .where(
      eq(cfFinanceTransactions.id, id) &&
        eq(cfFinanceTransactions.tenantId, tenantId)
    )
    .limit(1);

  if (!existing) throw new ApiError(404, "Transaction not found");
  if (existing.status !== "Approved")
    throw new ApiError(400, "Only approved transactions can be reversed");
  if (existing.immutableAt)
    throw new ApiError(
      400,
      "This transaction has been finalized and cannot be reversed"
    );

  // Create reversal transaction
  const reversalType = existing.type === "Income" ? "Expense" : "Income";
  const prefix = reversalType === "Income" ? "INC" : "EXP";
  const datePart = new Date().toISOString().replace(/-/g, "").slice(2, 8);
  const [countResult] = await db
    .select({ value: count() })
    .from(cfFinanceTransactions)
    .where(eq(cfFinanceTransactions.tenantId, tenantId));
  const seq = String((countResult?.value || 0) + 1).padStart(3, "0");
  const reversalReference = `CF-${prefix}-${datePart}-${seq}`;

  await db.insert(cfFinanceTransactions).values({
    tenantId,
    reference: reversalReference,
    type: reversalType,
    category: existing.category,
    fundId: existing.fundId,
    amountPesewas: existing.amountPesewas,
    transactionDate: new Date().toISOString().split("T")[0],
    paymentMethod: existing.paymentMethod,
    description: `Reversal of ${existing.reference}: ${reason}`,
    status: "Approved",
    recordedBy: user.fullName,
    recordedByUserId: undefined,
    recordedByEmail: user.email,
    approvedBy: user.fullName,
    approvedByUserId: undefined,
    approvedByEmail: user.email,
    approvedAt: new Date().toISOString(),
    immutableAt: new Date().toISOString(),
    reversalOfId: existing.id,
    reversalReason: reason,
  });

  // Mark original as reversed
  await db
    .update(cfFinanceTransactions)
    .set({ status: "Reversed", reversalReason: reason })
    .where(eq(cfFinanceTransactions.id, id));

  await writeTenantAudit(
    tenantId,
    user,
    "finance.transaction.reverse",
    "transaction",
    existing.reference,
    `Reversed transaction: ${existing.reference} - ${reason}`
  );

  return apiJson({ success: true }, 200, requestId);
}
