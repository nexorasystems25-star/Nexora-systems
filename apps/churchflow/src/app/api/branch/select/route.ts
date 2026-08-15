import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPrincipalFromRequest } from "@/lib/tenant";
import { resolveBranchScope, readActiveBranchCookie } from "@/lib/branch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Returns the caller's branch list + current selection (for the switcher UI).
export async function GET(request: Request) {
  const ctx = await getPrincipalFromRequest(request);
  if (!ctx) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { data: branches } = await supabase
    .from("branches")
    .select("*")
    .eq("organization_id", ctx.orgId)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });

  const scope = await resolveBranchScope(ctx.userId ?? "", ctx.orgId);
  return NextResponse.json({
    activeBranchId: readActiveBranchCookie(request),
    branches: branches ?? [],
    scope,
  });
}

// Sets the active-branch cookie, validated against the caller's allowed branches.
export async function POST(request: Request) {
  const ctx = await getPrincipalFromRequest(request);
  if (!ctx) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const requested = body.branchId;
  const normalized = !requested || requested === "all" ? null : requested;

  const scope = await resolveBranchScope(ctx.userId ?? "", ctx.orgId);
  if (normalized && !(scope.isOrgWide || scope.allowedBranchIds.includes(normalized))) {
    return NextResponse.json(
      { error: "Not permitted to select this branch" },
      { status: 403 }
    );
  }

  const res = NextResponse.json({ ok: true, activeBranchId: normalized });
  res.cookies.set("cf-active-branch", normalized ?? "all", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
