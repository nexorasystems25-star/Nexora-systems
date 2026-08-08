import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { orgName, email, password } = await request.json();

    if (!orgName || !email || !password) {
      return NextResponse.json(
        { error: "Organization name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // 1. Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    // 2. Create organization
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data: org, error: orgError } = await supabase
      .from("nexora_organizations")
      .insert({
        name: orgName,
        slug: `${slug}-${Date.now()}`,
        status: "active",
      })
      .select()
      .single();

    if (orgError) {
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json(
        { error: "Failed to create organization" },
        { status: 500 }
      );
    }

    // 3. Create membership (admin role)
    const { error: memberError } = await supabase
      .from("nexora_memberships")
      .insert({
        user_id: authUser.user.id,
        org_id: org.id,
        role: "admin",
        status: "active",
      });

    if (memberError) {
      // Rollback: delete org and auth user
      await supabase.from("nexora_organizations").delete().eq("id", org.id);
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json(
        { error: "Failed to create membership" },
        { status: 500 }
      );
    }

    // 4. Create trial subscription
    await supabase.from("nexora_subscriptions").insert({
      org_id: org.id,
      plan: "starter",
      status: "trialing",
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return NextResponse.json({
      success: true,
      user: { id: authUser.user.id, email },
      org: { id: org.id, name: orgName, slug: org.slug },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
