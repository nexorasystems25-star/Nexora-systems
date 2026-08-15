import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPrincipalFromRequest } from "@/lib/tenant";
import { isFeatureEnabledForOrg } from "@/lib/feature-flags";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Tenant admins (and platform/product supers) may manage branches.
function requireTenantAdmin(ctx: {
  isSuperAdmin?: boolean;
  role?: string | null;
} | null): NextResponse | null {
  if (!ctx) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (ctx.isSuperAdmin || ctx.role === "admin") return null;
  return NextResponse.json({ error: "Admin access required" }, { status: 403 });
}

export async function GET(request: Request) {
  const ctx = await getPrincipalFromRequest(request);
  const deny = requireTenantAdmin(ctx);
  if (deny) return deny;
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("organization_id", ctx!.orgId)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Surface whether the org may add another campus so the UI can prompt for an
  // upgrade proactively. The first campus is always free; a 2nd requires the
  // "multi_campus" feature flag enabled for the org's plan.
  const { count, error: countErr } = await supabase
    .from("branches")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", ctx!.orgId);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  const branchCount = count ?? 0;
  const multiCampusEnabled =
    branchCount === 0
      ? true
      : await isFeatureEnabledForOrg(supabase, "multi_campus", ctx!.orgId);

  return NextResponse.json({ branches: data ?? [], branchCount, multiCampusEnabled });
}

export async function POST(request: Request) {
  const ctx = await getPrincipalFromRequest(request);
  const deny = requireTenantAdmin(ctx);
  if (deny) return deny;

  const body = await request.json().catch(() => ({}));
  const { name, slug, address, timezone, isPrimary, clone_from } = body;
  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }
  const orgId = ctx!.orgId;

  // Billing gate: the first campus is free; creating a 2nd requires the
  // "multi_campus" feature flag enabled for this org's plan.
  const { count: existing, error: countErr } = await supabase
    .from("branches")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((existing ?? 0) > 0) {
    const allowed = await isFeatureEnabledForOrg(supabase, "multi_campus", orgId);
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "Multi-campus is not enabled on your current plan. Upgrade or enable the Multi-campus add-on to add more campuses.",
          upgradeRequired: true,
          feature: "multi_campus",
        },
        { status: 402 }
      );
    }
  }

  if (isPrimary) {
    await supabase
      .from("branches")
      .update({ is_primary: false })
      .eq("organization_id", orgId);
  }

  const { data, error } = await supabase
    .from("branches")
    .insert({
      organization_id: orgId,
      name,
      slug,
      address: address ?? null,
      timezone: timezone ?? null,
      is_primary: !!isPrimary,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let clonedFunds = 0;
  if (clone_from) {
    const { data: srcFunds, error: srcErr } = await supabase
      .from("cf_finance_funds")
      .select("name, code, purpose, status")
      .eq("tenant_id", orgId)
      .eq("branch_id", clone_from);
    if (!srcErr && srcFunds && srcFunds.length > 0) {
      const { error: insErr } = await supabase.from("cf_finance_funds").insert(
        srcFunds.map((f) => ({
          tenant_id: orgId,
          branch_id: data.id,
          name: f.name,
          code: f.code,
          purpose: f.purpose,
          status: f.status || "Active",
        }))
      );
      if (!insErr) clonedFunds = srcFunds.length;
    }
  }

  return NextResponse.json({ branch: data, clonedFunds }, { status: 201 });
}
