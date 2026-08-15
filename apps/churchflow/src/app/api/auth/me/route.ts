import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "No token provided" },
        { status: 401 }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("memberships")
      .select("*, organizations(*)")
      .eq("user_id", user.id);

    if (membershipError || !memberships || memberships.length === 0) {
      return NextResponse.json(
        { error: "No organization membership found" },
        { status: 403 }
      );
    }

    // A user may have several memberships (org-wide + per-branch). Resolve the
    // one for the requested tenant, or fall back to the first.
    const { searchParams } = new URL(request.url);
    const requestedOrg = searchParams.get("org_id");
    const membership =
      (requestedOrg && memberships.find((m) => m.org_id === requestedOrg)) ||
      memberships[0];

    const tenantMemberships = memberships.filter(
      (m) => m.org_id === membership.org_id
    );
    const allowedBranchIds = tenantMemberships
      .map((m) => m.branch_id)
      .filter((b): b is string => !!b);
    const isOrgWide = tenantMemberships.some((m) => m.branch_id === null);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email,
      },
      tenant: {
        id: membership.org_id,
        name: membership.organizations?.name,
        slug: membership.organizations?.slug,
      },
      role: membership.role,
      branchScope: { isOrgWide, allowedBranchIds },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
