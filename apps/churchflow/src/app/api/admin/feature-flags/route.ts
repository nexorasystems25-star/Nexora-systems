import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function requireAdmin(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "platform_admin") return null;
  return user;
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: flags, error } = await supabase
      .from("feature_flags")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ flags: flags || [] });
  } catch (error) {
    console.error("Admin feature-flags GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, enabled, rollout_percentage, allowed_plans } =
      body;

    if (!name) {
      return NextResponse.json(
        { error: "Flag name is required" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("feature_flags")
      .select("id")
      .eq("name", name)
      .single();

    if (existing) {
      const { data: flag, error } = await supabase
        .from("feature_flags")
        .update({
          description: description ?? undefined,
          enabled: enabled ?? undefined,
          rollout_percentage: rollout_percentage ?? undefined,
          allowed_plans: allowed_plans ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ flag });
    }

    const { data: flag, error } = await supabase
      .from("feature_flags")
      .insert({
        name,
        description: description || null,
        enabled: enabled ?? false,
        rollout_percentage: rollout_percentage ?? 0,
        allowed_plans: allowed_plans || [],
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ flag }, { status: 201 });
  } catch (error) {
    console.error("Admin feature-flags POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
