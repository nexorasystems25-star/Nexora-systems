import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPrincipalFromRequest } from "@/lib/tenant";
import { requestBranchContext, applyBranchFilter } from "@/lib/branch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function requireTenantAdmin(ctx: { isSuperAdmin?: boolean; role?: string | null } | null) {
  if (!ctx) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (ctx.isSuperAdmin || ctx.role === "admin") return null;
  return NextResponse.json({ error: "Admin access required" }, { status: 403 });
}

const EXPENSE_RE = /expense|expenditure|cost|payment|disburse/i;

interface CampusBucket {
  branchId: string; // actual branch id, or "shared" for org-wide (null branch)
  name: string;
  isPrimary: boolean;
  income: number;
  expense: number;
  net: number;
  members: number;
  events: number;
}

export async function GET(request: Request) {
  const ctx = await getPrincipalFromRequest(request);
  const deny = requireTenantAdmin(ctx);
  if (deny) return deny;

  const orgId = ctx!.orgId;
  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const from =
    searchParams.get("from") ||
    new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const branchCtx = (await requestBranchContext(request, orgId)) ?? {
    orgId,
    isOrgWide: true,
    allowedBranchIds: [] as string[],
    activeBranchId: null,
  };

  // Branches (for names); restricted to what the caller may see.
  let branchQuery = supabase
    .from("branches")
    .select("id, name, is_primary")
    .eq("organization_id", orgId);
  branchQuery = applyBranchFilter(branchQuery, branchCtx);
  const { data: branches } = await branchQuery;
  const branchMap = new Map<string, { name: string; isPrimary: boolean }>();
  for (const b of branches ?? []) branchMap.set(b.id, { name: b.name, isPrimary: !!b.is_primary });

  // Finance: group by branch + type, sum pesewas.
  let finQuery = supabase
    .from("cf_finance_transactions")
    .select("branch_id, type, amount_pesewas.sum()")
    .eq("tenant_id", orgId)
    .gte("created_at", from)
    .lte("created_at", to);
  finQuery = applyBranchFilter(finQuery, branchCtx);
  const { data: finRows, error: finErr } = await finQuery;
  if (finErr) return NextResponse.json({ error: finErr.message }, { status: 500 });

  // Members (active) grouped by branch.
  let memQuery = supabase
    .from("cf_members")
    .select("branch_id, count")
    .eq("tenant_id", orgId)
    .eq("status", "active");
  memQuery = applyBranchFilter(memQuery, branchCtx);
  const { data: memRows, error: memErr } = await memQuery;
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  // Events grouped by branch.
  let evtQuery = supabase.from("cf_events").select("branch_id, count").eq("tenant_id", orgId);
  evtQuery = applyBranchFilter(evtQuery, branchCtx);
  const { data: evtRows, error: evtErr } = await evtQuery;
  if (evtErr) return NextResponse.json({ error: evtErr.message }, { status: 500 });

  const buckets = new Map<string, CampusBucket>();
  const ensure = (key: string, name: string, isPrimary = false): CampusBucket => {
    let b = buckets.get(key);
    if (!b) {
      b = { branchId: key, name, isPrimary, income: 0, expense: 0, net: 0, members: 0, events: 0 };
      buckets.set(key, b);
    }
    return b;
  };
  const labelFor = (id: string | null) =>
    id ? branchMap.get(id)?.name ?? "Unknown campus" : "Shared (org-wide)";

  // Finance
  for (const row of (finRows ?? []) as { branch_id: string | null; type: string | null; sum: number | null }[]) {
    const key = row.branch_id ?? "shared";
    const b = ensure(key, labelFor(row.branch_id), row.branch_id ? !!branchMap.get(row.branch_id)?.isPrimary : false);
    const pesewas = Number(row.sum ?? 0);
    const cedis = pesewas / 100;
    if (row.type && EXPENSE_RE.test(row.type)) b.expense += cedis;
    else b.income += cedis;
  }
  // Members
  for (const row of (memRows ?? []) as { branch_id: string | null; count: number }[]) {
    const key = row.branch_id ?? "shared";
    const b = ensure(key, labelFor(row.branch_id), row.branch_id ? !!branchMap.get(row.branch_id)?.isPrimary : false);
    b.members = Number(row.count ?? 0);
  }
  // Events
  for (const row of (evtRows ?? []) as { branch_id: string | null; count: number }[]) {
    const key = row.branch_id ?? "shared";
    const b = ensure(key, labelFor(row.branch_id), row.branch_id ? !!branchMap.get(row.branch_id)?.isPrimary : false);
    b.events = Number(row.count ?? 0);
  }

  const byCampus = Array.from(buckets.values()).map((b) => ({ ...b, net: b.income - b.expense }));
  const consolidated = byCampus.reduce(
    (acc, b) => {
      acc.income += b.income;
      acc.expense += b.expense;
      acc.net += b.net;
      acc.members += b.members;
      acc.events += b.events;
      return acc;
    },
    { income: 0, expense: 0, net: 0, members: 0, events: 0 }
  );

  const fmt = (n: number) => `GH₵ ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return NextResponse.json({
    range: { from, to },
    consolidated: { ...consolidated, incomeFmt: fmt(consolidated.income), expenseFmt: fmt(consolidated.expense), netFmt: fmt(consolidated.net) },
    byCampus: byCampus
      .sort((a, b) => (b.branchId === "shared" ? 1 : 0) - (a.branchId === "shared" ? 1 : 0))
      .map((b) => ({ ...b, incomeFmt: fmt(b.income), expenseFmt: fmt(b.expense), netFmt: fmt(b.net) })),
  });
}
