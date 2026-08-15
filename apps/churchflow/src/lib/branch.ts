import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPrincipalFromRequest } from "@/lib/tenant";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Branch-scoping contract for ChurchFlow tenant data.
//
// Semantics:
//  - A membership with branch_id IS NULL is org-wide (sees every branch).
//  - A membership with a branch_id is scoped to that single branch.
//  - A tenant record (cf_*) with branch_id IS NULL is shared org-wide (visible
//    to everyone in the tenant); branch_id set means it belongs to that campus.
//  - The service-role client bypasses RLS, so every filter below is applied in
//    application code — RLS on `branches` is defense-in-depth only.

export interface BranchScope {
  orgId: string;
  isOrgWide: boolean;
  allowedBranchIds: string[];
}

export interface BranchContext {
  orgId: string;
  isOrgWide: boolean;
  allowedBranchIds: string[];
  /** Currently selected branch, or null = "all branches I'm allowed to see". */
  activeBranchId: string | null;
}

// Resolve the caller's branch scope within a tenant from their active memberships.
export async function resolveBranchScope(
  userId: string,
  orgId: string,
  client: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey)
): Promise<BranchScope> {
  const { data } = await client
    .from("memberships")
    .select("branch_id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("status", "active");
  const rows = (data ?? []) as { branch_id: string | null }[];
  const allowedBranchIds = rows
    .map((r) => r.branch_id)
    .filter((b): b is string => !!b);
  const isOrgWide = rows.some((r) => r.branch_id === null);
  return { orgId, isOrgWide, allowedBranchIds };
}

// Read the active-branch selection cookie ("all" or a branch id, or absent).
export function readActiveBranchCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/cf-active-branch=([^;]+)/);
  if (!m) return null;
  const v = decodeURIComponent(m[1]);
  return v && v !== "all" ? v : null;
}

// Combine the user's allowed scope with the requested active branch.
export function computeBranchContext(
  scope: BranchScope,
  activeBranchId: string | null
): BranchContext {
  let active = activeBranchId;
  if (active) {
    const permitted = scope.isOrgWide || scope.allowedBranchIds.includes(active);
    if (!permitted) active = null; // selection not allowed -> ignore
  }
  // Branch-scoped users with a single branch are locked to it.
  if (!scope.isOrgWide && scope.allowedBranchIds.length === 1 && !active) {
    active = scope.allowedBranchIds[0];
  }
  return {
    orgId: scope.orgId,
    isOrgWide: scope.isOrgWide,
    allowedBranchIds: scope.allowedBranchIds,
    activeBranchId: active,
  };
}

// Build a BranchContext from a request's principal + active-branch cookie.
export async function branchContextFromRequest(
  request: Request,
  userId: string | null,
  orgId: string
): Promise<BranchContext | null> {
  if (!userId) return null;
  const scope = await resolveBranchScope(userId, orgId);
  return computeBranchContext(scope, readActiveBranchCookie(request));
}

// Convenience: resolve the branch context for an incoming tenant request.
export async function requestBranchContext(
  request: Request,
  orgId: string
): Promise<BranchContext | null> {
  const principal = await getPrincipalFromRequest(request);
  if (!principal?.userId) return null;
  return branchContextFromRequest(request, principal.userId, orgId);
}

// Apply the branch visibility filter to a Supabase query builder.
export function applyBranchFilter<T>(query: T, ctx: BranchContext | null): T {
  if (!ctx) return query;
  const active = ctx.activeBranchId;
  if (active) {
    return (query as { or: (s: string) => T }).or(
      `branch_id.is.null,branch_id.eq.${active}`
    );
  }
  if (!ctx.isOrgWide) {
    if (ctx.allowedBranchIds.length === 0) {
      return (query as { eq: (c: string, v: string) => T }).eq(
        "branch_id",
        "__deny__"
      );
    }
    return (query as { or: (s: string) => T }).or(
      `branch_id.is.null,branch_id.in.(${ctx.allowedBranchIds.join(",")})`
    );
  }
  // org-wide, no specific selection -> see everything
  return query;
}

// Resolve the branch_id to stamp on a newly created record.
export function branchIdForWrite(
  ctx: BranchContext | null,
  requested?: string | null
): string | null {
  if (!ctx) return requested ?? null;
  if (ctx.activeBranchId) return ctx.activeBranchId;
  if (!ctx.isOrgWide) {
    return ctx.allowedBranchIds.length === 1
      ? ctx.allowedBranchIds[0]
      : requested ?? ctx.allowedBranchIds[0] ?? null;
  }
  return requested ?? null;
}
