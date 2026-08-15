import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPrincipalFromRequest } from "@/lib/tenant";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

function requireTenantAdmin(ctx: {
  isSuperAdmin?: boolean;
  role?: string | null;
  orgId: string;
} | null): NextResponse | null {
  if (!ctx) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (ctx.isSuperAdmin || ctx.role === "admin") return null;
  return NextResponse.json({ error: "Admin access required" }, { status: 403 });
}

async function ownedBranch(ctx: { orgId: string }, id: string) {
  const { data } = await supabase
    .from("branches")
    .select("organization_id")
    .eq("id", id)
    .single();
  if (!data || data.organization_id !== ctx.orgId) return null;
  return data;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getPrincipalFromRequest(request);
  const deny = requireTenantAdmin(ctx);
  if (deny) return deny;

  const branch = await ownedBranch(ctx!, params.id);
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { name, slug, address, timezone, isPrimary } = body;
  const orgId = ctx!.orgId;

  if (isPrimary) {
    await supabase
      .from("branches")
      .update({ is_primary: false })
      .eq("organization_id", orgId);
  }

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (slug !== undefined) patch.slug = slug;
  if (address !== undefined) patch.address = address;
  if (timezone !== undefined) patch.timezone = timezone;
  if (isPrimary !== undefined) patch.is_primary = !!isPrimary;

  const { data, error } = await supabase
    .from("branches")
    .update(patch)
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ branch: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getPrincipalFromRequest(request);
  const deny = requireTenantAdmin(ctx);
  if (deny) return deny;

  const branch = await ownedBranch(ctx!, params.id);
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ON DELETE SET NULL cascades branch_id to NULL on tenant records.
  const { error } = await supabase.from("branches").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
