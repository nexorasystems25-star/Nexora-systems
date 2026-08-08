import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  organizations,
  products,
  memberships,
  subscriptions,
  auditEvents,
  tenantDomains,
} from "../../../../db/schema-platform";
import { PRODUCT_DOMAINS } from "../../../../packages/config/src/domains";
import { resolvePlatformUser, type PlatformUser } from "../../../../lib/auth-platform";
import { apiJson, getRequestId, readJson, ApiError } from "../../_security";

// ============================================================================
// TENANT ONBOARDING API
// ============================================================================
// Handles new tenant setup: organization, subscription, admin user
// ============================================================================

interface OnboardingPayload {
  // Organization info
  organizationName: string;
  organizationSlug: string;
  sector?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Subscription info
  productId?: string;
  plan?: string;

  // Admin user (optional - for inviting admin)
  adminEmail?: string;
  adminName?: string;
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    // Resolve user (must be platform user or new signup)
    const user = await resolvePlatformUser(request);

    const payload = await readJson<OnboardingPayload>(request);

    // Validate required fields
    if (!payload.organizationName?.trim()) {
      throw new ApiError(400, "Organization name is required");
    }
    if (!payload.organizationSlug?.trim()) {
      throw new ApiError(400, "Organization slug is required");
    }

    // Validate slug format
    const slug = payload.organizationSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (slug.length < 3) {
      throw new ApiError(400, "Slug must be at least 3 characters");
    }

    const db = await getDb();

    // Check if slug already exists
    const [existingOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (existingOrg) {
      throw new ApiError(409, "Organization slug already exists");
    }

    // Get ChurchFlow product
    const [churchflow] = await db
      .select()
      .from(products)
      .where(eq(products.slug, "churchflow"))
      .limit(1);

    if (!churchflow) {
      throw new ApiError(500, "ChurchFlow product not configured");
    }

    // Create organization
    const [org] = await db
      .insert(organizations)
      .values({
        name: payload.organizationName.trim(),
        slug,
        sector: payload.sector || "church",
        lifecycle: "onboarding",
        status: "active",
        metadata: {
          contactEmail: payload.contactEmail,
          contactPhone: payload.contactPhone,
          onboardedBy: user?.email || "self-service",
          onboardedAt: new Date().toISOString(),
        },
      })
      .returning();

    // Create tenant domain
    const productSlug = "churchflow";
    const baseDomain = PRODUCT_DOMAINS[productSlug];
    if (baseDomain) {
      const domain = `${slug}.${baseDomain}`;
      await db.insert(tenantDomains).values({
        organizationId: org.id,
        domain,
        productSlug,
        isPrimary: true,
      });
    }

    // Create subscription (trial)
    const [sub] = await db
      .insert(subscriptions)
      .values({
        organizationId: org.id,
        productId: churchflow.id,
        plan: payload.plan || "professional",
        status: "trialing",
        monthlyAmount: getPlanAmount(payload.plan || "professional"),
        currency: "GHS",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
        renewalAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      })
      .returning();

    // If user is platform user, create membership
    if (user?.isPlatformUser) {
      await db.insert(memberships).values({
        identityId: user.identityId,
        organizationId: org.id,
        productId: churchflow.id,
        role: "tenant_admin",
        scope: "tenant",
        status: "active",
      });
    }

    // If admin email provided, create invitation
    if (payload.adminEmail && payload.adminName) {
      // This would trigger an email invitation in production
      // For now, we'll log it
      console.log("Admin invitation:", {
        email: payload.adminEmail,
        name: payload.adminName,
        orgId: org.id,
        orgSlug: slug,
      });
    }

    // Audit log
    await db.insert(auditEvents).values({
      organizationId: org.id,
      actorId: user?.identityId || null,
      actorEmail: user?.email || "system",
      action: "tenant.onboard",
      entityType: "organization",
      entityId: org.id,
      payload: {
        name: payload.organizationName,
        slug,
        plan: payload.plan || "professional",
      },
    });

    return apiJson(
      {
        success: true,
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          lifecycle: org.lifecycle,
        },
        subscription: {
          id: sub.id,
          plan: sub.plan,
          status: sub.status,
          trialEndsAt: sub.trialEndsAt,
        },
      },
      201,
      requestId
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return apiJson({ error: error.publicMessage }, error.status, requestId);
    }
    console.error("Onboarding failed:", error);
    return apiJson({ error: "Onboarding failed" }, 500, requestId);
  }
}

function getPlanAmount(plan: string): number {
  const amounts: Record<string, number> = {
    starter: 9900, // GHS 99
    professional: 29900, // GHS 299
    enterprise: 59900, // GHS 599
  };
  return amounts[plan] || amounts.professional;
}
