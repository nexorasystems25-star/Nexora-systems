import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/auth";
import { getAccessContext, requireScope } from "@/lib/access";

// Product super-admin plane: manage product_memberships for a product.
// Allowed: platform staff OR a product super-admin (product_owner/product_admin)
// scoped to the exact productId in the request — no cross-product writes.

export async function GET(req: NextRequest) {
  const ctx = await getAccessContext(req);
  const productId = req.nextUrl.searchParams.get("productId");
  const guard = requireScope(ctx, "product", productId ?? undefined);
  if (guard) return guard;
  if (ctx!.actorScope === "product" && ctx!.productId !== productId) {
    return NextResponse.json({ error: "Product mismatch" }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("product_memberships")
    .select("*")
    .eq("product_id", productId!);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const ctx = await getAccessContext(req);
  const body = await req.json();
  const guard = requireScope(ctx, "product", body.productId);
  if (guard) return guard;
  if (ctx!.actorScope === "product" && ctx!.productId !== body.productId) {
    return NextResponse.json({ error: "Product mismatch" }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("product_memberships")
    .insert({
      product_id: body.productId,
      identity_id: body.identityId,
      role: body.role ?? "product_support",
      granted_by: ctx!.userId,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAccessContext(req);
  const id = req.nextUrl.searchParams.get("id");
  const guard = requireScope(ctx, "product");
  if (guard) return guard;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabaseAdmin
    .from("product_memberships")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
