import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/auth";
import { getAccessContext, requireScope, requirePlatformOwner } from "@/lib/access";

const STAFF_ROLES = ["owner", "support", "billing", "success"];

// Platform staff plane: manage platform_staff.
// SECURITY: restricted to platform_owner only (least privilege). nexora_staff
// may use /platform but may NOT grant/revoke platform staff roles.

// Platform-owner enforcement lives in requirePlatformOwner (lib/access).

export async function GET(req: NextRequest) {
  const ctx = await getAccessContext(req);
  const guard = requireScope(ctx, "platform");
  if (guard) return guard;
  const deny = requirePlatformOwner(ctx!);
  if (deny) return deny;
  const { data, error } = await supabaseAdmin.from("platform_staff").select("*");
  if (error) return NextResponse.json({ error: "Internal error" }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const ctx = await getAccessContext(req);
  const guard = requireScope(ctx, "platform");
  if (guard) return guard;
  const deny = requirePlatformOwner(ctx!);
  if (deny) return deny;
  const body = await req.json();
  const identityId = body.identityId;
  const role = body.role ?? "support";
  if (!identityId || typeof identityId !== "string") {
    return NextResponse.json({ error: "identityId is required" }, { status: 400 });
  }
  if (!STAFF_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("platform_staff")
    .insert({
      identity_id: identityId,
      role,
      permissions: Array.isArray(body.permissions) ? body.permissions : [],
      granted_by: ctx!.userId,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Internal error" }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAccessContext(req);
  const guard = requireScope(ctx, "platform");
  if (guard) return guard;
  const deny = requirePlatformOwner(ctx!);
  if (deny) return deny;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabaseAdmin.from("platform_staff").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Internal error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
