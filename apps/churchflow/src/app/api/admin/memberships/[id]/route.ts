import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPrincipalFromRequest } from "@/lib/tenant";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const principal = await getPrincipalFromRequest(request);
  if (!principal || (principal.role !== "admin" && !principal.isSuperAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = principal.orgId;
  const id = params.id;

  const body = await request.json().catch(() => ({}));
  const { role, branch_id } = body as { role?: string; branch_id?: string | null };

  const updates: Record<string, unknown> = {};
  if (typeof role === "string" && role.trim()) updates.role = role.trim();
  if ("branch_id" in body) {
    // null => org-wide scope; otherwise must belong to this org.
    if (branch_id === null) {
      updates.branch_id = null;
    } else if (typeof branch_id === "string" && branch_id) {
      const { data: branch, error: bErr } = await supabase
        .from("branches")
        .select("id")
        .eq("id", branch_id)
        .eq("organization_id", orgId)
        .single();
      if (bErr || !branch) {
        return NextResponse.json({ error: "Branch not found in this organization" }, { status: 400 });
      }
      updates.branch_id = branch_id;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data: membership, error } = await supabase
    .from("memberships")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id, user_id, org_id, role, status, branch_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  return NextResponse.json({
    membership: {
      id: membership.id,
      userId: membership.user_id,
      role: membership.role,
      status: membership.status,
      branchId: membership.branch_id,
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const principal = await getPrincipalFromRequest(request);
  if (!principal || (principal.role !== "admin" && !principal.isSuperAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = principal.orgId;
  const id = params.id;

  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
