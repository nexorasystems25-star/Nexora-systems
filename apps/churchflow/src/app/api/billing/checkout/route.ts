import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe, PLANS, type PlanTier } from "@/lib/stripe";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.churchflow.app";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getTenantFromRequest(request: Request): Promise<{ tenantId: string; email: string } | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  const { data: membership } = await supabase
    .from("nexora_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) return null;

  return { tenantId: membership.org_id, email: user.email! };
}

export async function POST(request: Request) {
  try {
    const auth = await getTenantFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan, interval = "monthly" } = await request.json();

    if (!plan || !PLANS[plan as PlanTier]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const planConfig = PLANS[plan as PlanTier];
    if (planConfig.monthlyPrice === 0) {
      return NextResponse.json({ error: "Cannot checkout for free plan" }, { status: 400 });
    }

    const { data: org } = await supabase
      .from("nexora_organizations")
      .select("stripe_customer_id, name")
      .eq("id", auth.tenantId)
      .single();

    let customerId = org?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: auth.email,
        name: org?.name || "Church",
        metadata: {
          tenantId: auth.tenantId,
        },
      });
      customerId = customer.id;

      await supabase
        .from("nexora_organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", auth.tenantId);
    }

    const priceId = interval === "yearly"
      ? planConfig.stripeYearlyPriceId
      : planConfig.stripeMonthlyPriceId;

    if (!priceId) {
      return NextResponse.json({ error: "Price not configured" }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing?canceled=true`,
      metadata: {
        tenantId: auth.tenantId,
        plan,
        interval,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
