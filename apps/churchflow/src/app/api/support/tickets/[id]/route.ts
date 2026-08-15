import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/auth";
import { getAccessContext, requireScope } from "@/lib/access";

// Tenant ticket detail. Ownership is enforced by matching organization_id,
// so a tenant can never read another organization's ticket.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getAccessContext(req);
  const gate = requireScope(ctx, "tenant");
  if (gate) return gate;

  const { data: ticket, error } = await supabaseAdmin
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx!.orgId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Internal error" }, { status: 500 });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: messages } = await supabaseAdmin
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ ticket, messages: messages ?? [] });
}
