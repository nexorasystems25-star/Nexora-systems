import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/auth";
import { getAccessContext, requireScope } from "@/lib/access";

const PRIORITIES = ["low", "medium", "high", "urgent"];
const CATEGORIES = ["general", "billing", "technical", "feature", "bug", "account"];

// Tenant-facing support inbox. Lists only tickets belonging to the caller's
// organization (enforced by organization_id filter — never trust a client id).
export async function GET(req: NextRequest) {
  const ctx = await getAccessContext(req);
  const gate = requireScope(ctx, "tenant");
  if (gate) return gate;

  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .select("*")
    .eq("organization_id", ctx!.orgId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Internal error" }, { status: 500 });
  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ctx = await getAccessContext(req);
  const gate = requireScope(ctx, "tenant");
  if (gate) return gate;
  if (!ctx!.userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  if (!subject) {
    return NextResponse.json({ error: "Subject is required" }, { status: 422 });
  }

  const priority = PRIORITIES.includes(body.priority as string) ? (body.priority as string) : "medium";
  const category = CATEGORIES.includes(body.category as string) ? (body.category as string) : "general";

  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .insert({
      organization_id: ctx!.orgId,
      product_id: ctx!.productId ?? null,
      identity_id: ctx!.userId,
      created_by: ctx!.userId,
      subject,
      description: typeof body.description === "string" ? body.description : null,
      priority,
      category,
      product_area: typeof body.productArea === "string" ? body.productArea : null,
      status: "open",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Internal error" }, { status: 500 });
  return NextResponse.json({ ticket: data }, { status: 201 });
}
