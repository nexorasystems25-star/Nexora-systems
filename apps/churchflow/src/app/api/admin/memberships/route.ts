import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPrincipalFromRequest } from "@/lib/tenant";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface MembershipRow {
  id: string;
  user_id: string;
  org_id: string;
  role: string | null;
  status: string | null;
  branch_id: string | null;
}

export async function GET(request: Request) {
  const principal = await getPrincipalFromRequest(request);
  if (!principal || (principal.role !== "admin" && !principal.isSuperAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = principal.orgId;

  const { data: rows, error } = await supabase
    .from("memberships")
    .select("id, user_id, org_id, role, status, branch_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolve display names from auth users (service-role can read auth.users).
  const userMap = new Map<string, { name: string; email: string }>();
  try {
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of list.users) {
      userMap.set(u.id, {
        name: (u.user_metadata?.name as string) || u.email || u.id,
        email: u.email || "",
      });
    }
  } catch {
    // names are best-effort; fall back to ids below
  }

  const memberships = (rows as MembershipRow[]).map((m) => ({
    id: m.id,
    userId: m.user_id,
    role: m.role,
    status: m.status,
    branchId: m.branch_id,
    user: userMap.get(m.user_id) || { name: m.user_id, email: "" },
  }));

  return NextResponse.json({ memberships });
}
