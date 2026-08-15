import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: membership, error: membershipError } = await adminClient
      .from("memberships")
      .select("*, organizations(*)")
      .eq("identity_id", user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "No organization membership found" },
        { status: 403 }
      );
    }

    const isPlatformRole = membership.role === "platform_owner" || membership.role === "nexora_staff";

    // Resolve the product super-admin plane (e.g. ChurchFlow product owner)
    // from product_memberships for the product this tenant belongs to.
    let actorScope: "platform" | "product" | "tenant" = "tenant";
    let productId: string | undefined;
    let productRoles: string[] = [];
    if (isPlatformRole) {
      actorScope = "platform";
    } else {
      const orgProductId = (membership.organizations as { product_id?: string } | undefined)?.product_id ?? null;
      if (orgProductId) {
        const { data: pm } = await adminClient
          .from("product_memberships")
          .select("role, product_id")
          .eq("identity_id", user.id)
          .eq("product_id", orgProductId)
          .eq("status", "active")
          .maybeSingle();
        if (pm) {
          actorScope = "product";
          productId = pm.product_id;
          productRoles = [pm.role];
        }
      }
    }

    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: membership.role,
      isSuperAdmin: isPlatformRole,
      organizationId: membership.organization_id,
      actorScope,
      productId,
      productRoles,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email,
      },
      tenant: {
        id: membership.organization_id,
        name: membership.organizations?.name,
        slug: membership.organizations?.slug,
      },
      role: membership.role,
    });

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
