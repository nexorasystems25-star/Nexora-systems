import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/auth";
import { getAccessContext, requireScope } from "@/lib/access";

// Tenant reply on their own ticket. The ticket must belong to the caller's
// organization before any write occurs.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getAccessContext(req);
  const gate = requireScope(ctx, "tenant");
  if (gate) return gate;
  if (!ctx!.userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { data: ticket, error: tErr } = await supabaseAdmin
    .from("support_tickets")
    .select("id")
    .eq("id", id)
    .eq("organization_id", ctx!.orgId)
    .maybeSingle();
  if (tErr) return NextResponse.json({ error: "Internal error" }, { status: 500 });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.message === "string" ? body.message.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Message is required" }, { status: 422 });
  }

  const { data, error } = await supabaseAdmin
    .from("support_ticket_messages")
    .insert({
      ticket_id: id,
      author_identity_id: ctx!.userId,
      author_scope: "tenant",
      body: text,
      is_internal: false,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Internal error" }, { status: 500 });
  return NextResponse.json({ message: data }, { status: 201 });
}
