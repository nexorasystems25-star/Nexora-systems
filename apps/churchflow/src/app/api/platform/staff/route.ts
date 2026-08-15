import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/auth";
import { getAccessContext, requireScope } from "@/lib/access";

// Platform staff plane: manage platform_staff.
// SECURITY: restricted to platform_owner only (least privilege). nexora_staff
// may use /platform but may NOT grant/revoke platform staff roles.

function assertOwner(ctx: NonNullable<Awaited<ReturnType<typeof getAccessContext>>>) {
  if (ctx.role !== "platform_owner" && !ctx.isSuperAdmin) {
    return NextResponse.json({ error: "Platform owner access required" }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const ctx = await getAccessContext(req);
  const guard = requireScope(ctx, "platform");
  if (guard) return guard;
  const deny = assertOwner(ctx!);
  if (deny) return deny;
  const { data, error } = await supabaseAdmin.from("platform_staff").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const ctx = await getAccessContext(req);
  const guard = requireScope(ctx, "platform");
  if (guard) return guard;
  const deny = assertOwner(ctx!);
  if (deny) return deny;
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("platform_staff")
    .insert({
      identity_id: body.identityId,
      role: body.role ?? "support",
      permissions: body.permissions ?? [],
      granted_by: ctx!.userId,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAccessContext(req);
  const guard = requireScope(ctx, "platform");
  if (guard) return guard;
  const deny = assertOwner(ctx!);
  if (deny) return deny;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabaseAdmin.from("platform_staff").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
