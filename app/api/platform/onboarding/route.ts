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

    // Idempotency check: return existing organization if slug already exists
    const [existingOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (existingOrg) {
      console.log("Onboarding idempotent hit:", { slug, existingOrgId: existingOrg.id });
      return apiJson(
        {
          success: true,
          organization: existingOrg,
          idempotent: true,
        },
        200,
        requestId
      );
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

    // Create all resources in a transaction for atomicity
    const result = await db.transaction(async (tx) => {
      // Create organization
      const [org] = await tx
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
        await tx.insert(tenantDomains).values({
          organizationId: org.id,
          domain,
          productSlug,
          isPrimary: true,
        });
      }

      // Create subscription (trial)
      const [sub] = await tx
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
        await tx.insert(memberships).values({
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
      await tx.insert(auditEvents).values({
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

      return { org, sub };
    });

    return apiJson(
      {
        success: true,
        organization: {
          id: result.org.id,
          name: result.org.name,
          slug: result.org.slug,
          lifecycle: result.org.lifecycle,
        },
        subscription: {
          id: result.sub.id,
          plan: result.sub.plan,
          status: result.sub.status,
          trialEndsAt: result.sub.trialEndsAt,
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
