import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/auth";
import { getAccessContext, requireScope, assertWithinProduct } from "@/lib/access";

const PRODUCT_ROLES = ["product_owner", "product_admin", "product_support"];

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
  if (error) return NextResponse.json({ error: "Internal error" }, { status: 500 });
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
  const productId = body.productId;
  const identityId = body.identityId;
  const role = body.role ?? "product_support";
  if (!productId || !identityId || typeof productId !== "string" || typeof identityId !== "string") {
    return NextResponse.json({ error: "productId and identityId are required" }, { status: 400 });
  }
  if (!PRODUCT_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("product_memberships")
    .insert({
      product_id: productId,
      identity_id: identityId,
      role,
      granted_by: ctx!.userId,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Internal error" }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAccessContext(req);
  const id = req.nextUrl.searchParams.get("id");
  const guard = requireScope(ctx, "product");
  if (guard) return guard;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  // Product-scoped callers may only delete memberships within their own product.
  // Platform callers (actorScope "platform") may manage all products.
  if (ctx!.actorScope === "product") {
    const { data: target, error: lookupError } = await supabaseAdmin
      .from("product_memberships")
      .select("product_id")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Internal error" }, { status: 500 });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const denied = assertWithinProduct(ctx, target.product_id);
    if (denied) return denied;
  }
  const { error } = await supabaseAdmin
    .from("product_memberships")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ error: "Internal error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
